import { RequestsList } from "./RequestsList";

/** Заявки объекта: все виды или вид, выбранный кнопкой слева (ТЗ 7.4, 7.7). */
export function ObjectRequests({
  objectId,
  typeId,
  onClearType,
}: {
  objectId: string;
  typeId: string | undefined;
  onClearType: () => void;
}) {
  return <RequestsList objectId={objectId} typeId={typeId} onClearType={onClearType} />;
}
