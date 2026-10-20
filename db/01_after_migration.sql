-- =====================================================================
-- ООО «Лидер» · Версия 1 · Запуск после миграции и seed
-- Порядок: lider_v1_migration.sql → lider_v1_seed_spravochniki.sql → этот файл
-- Перед запуском: создать двух пользователей в Supabase → Authentication → Users
-- и подставить их email ниже (две строки с пометкой «ЗАМЕНИТЬ»).
-- =====================================================================

-- 1. Закрыть прямой вызов log_history (ТЗ 1.3: права — в БД).
--    В миграции снято только с authenticated, но по умолчанию функция доступна PUBLIC и anon.
revoke execute on function public.log_history(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;

-- 2. Сотрудники с логином (ТЗ 4 «Первый администратор», 9)
insert into public.profiles(user_id, full_name, role_code, email)
select id, 'Администратор', 'admin', email
from auth.users where email = 'admin@example.com';          -- ЗАМЕНИТЬ на свой email

insert into public.profiles(user_id, full_name, role_code, email)
select id, 'Прораб (тест)', 'foreman', email
from auth.users where email = 'foreman@example.com';        -- ЗАМЕНИТЬ на email тестового прораба

-- 3. Сотрудники без логина (ТЗ 9)
insert into public.profiles(full_name, role_code) values
  ('Муслим',            'director'),
  ('Галина Ивановна',   'pto'),
  ('Милана',            'office'),
  ('Снабжение (тест)',  'supply');

-- 4. Заказчики с контактами (ТЗ 9)
with c as (
  insert into public.customers(name) values ('АО «МОСГАЗ»') returning id
)
insert into public.customer_contacts(customer_id, full_name, position, sort)
select id, v.full_name, v.position, v.sort from c,
  (values ('Контакт 1 (тест)', 'Куратор объекта', 1),
          ('Контакт 2 (тест)', 'Технадзор', 2)) as v(full_name, position, sort);

with c as (
  insert into public.customers(name) values ('Тестовый заказчик') returning id
)
insert into public.customer_contacts(customer_id, full_name, position, sort)
select id, 'Контакт (тест)', 'Представитель', 1 from c;

-- 5. Проверка: ожидаем admin_ok = 1, foreman_ok = 1, этапов 49, документов 25, видов заявок 10, bucket = 1
select
  (select count(*) from public.profiles where role_code = 'admin'   and user_id is not null) as admin_ok,
  (select count(*) from public.profiles where role_code = 'foreman' and user_id is not null) as foreman_ok,
  (select count(*) from public.stage_templates)  as stages,
  (select count(*) from public.documents)        as documents,
  (select count(*) from public.request_types)    as request_types,
  (select count(*) from storage.buckets where id = 'lider-files') as bucket;
