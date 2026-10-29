/** Form-level error from the server (`Problem.detail`). */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </div>
  );
}
