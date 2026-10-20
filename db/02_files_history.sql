-- =====================================================================
-- ООО «Лидер» · Версия 1 · Запись загрузки файлов в историю
-- Выполнить один раз после 01_after_migration.sql (Supabase → SQL Editor).
-- Основание: ТЗ 11 — «Каждое действие (статус, условие, шаг, файл, перенос)
-- появляется в истории этапа или заявки». Файл загружается напрямую в storage
-- и таблицу files, поэтому запись в history делает триггер.
-- =====================================================================

create or replace function public.tg_files_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_entity_type text;
  v_entity_id   uuid;
  v_where       text;
  v_kind        text := case new.kind
                          when 'draft'  then 'черновик на согласование'
                          when 'signed' then 'подписанный скан'
                          when 'photo'  then 'фото'
                          else 'файл' end;
  r record;
begin
  if new.entity_type = 'stage' then
    select id, number into r from public.object_stages where id = new.entity_id;
    v_entity_type := 'stage'; v_entity_id := r.id;
    v_where := format('Этап %s', r.number);
  elsif new.entity_type = 'stage_condition' then
    select s.id, s.number, c.title into r
    from public.object_stage_conditions c join public.object_stages s on s.id = c.stage_id
    where c.id = new.entity_id;
    v_entity_type := 'stage'; v_entity_id := r.id;
    v_where := format('Этап %s, условие «%s»', r.number, r.title);
  else
    -- request и request_field: entity_id — id заявки
    select id, number into r from public.requests where id = new.entity_id;
    v_entity_type := 'request'; v_entity_id := r.id;
    v_where := format('Заявка №%s', r.number);
  end if;

  perform public.log_history(new.object_id, v_entity_type, v_entity_id, 'file_uploaded',
    format('%s: загружен %s «%s»', v_where, v_kind, new.file_name),
    jsonb_build_object('file_id', new.id, 'kind', new.kind));
  return new;
end $$;

drop trigger if exists files_history on public.files;
create trigger files_history after insert on public.files
  for each row execute function public.tg_files_history();

-- Проверка: должна вернуться 1 строка
select count(*) as trigger_ok from pg_trigger where tgname = 'files_history';
