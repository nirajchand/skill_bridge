type TaskCardProps = {
  title?: string;
  price?: string;
  status?: string;
};

export default function TaskCard({ title = 'Task title', price = '$0', status = 'open' }: TaskCardProps) {
  return (
    <article className="rounded border border-slate-800 p-4">
      <h3>{title}</h3>
      <p>{price}</p>
      <p>{status}</p>
    </article>
  );
}
