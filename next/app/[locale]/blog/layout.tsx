export default function MdxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <article className="prose dark:prose-invert">{children}</article>
    </div>
  );
}
