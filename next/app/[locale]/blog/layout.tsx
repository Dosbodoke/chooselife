export default function MdxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <article className="prose text-black prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg dark:text-white dark:prose-headings:text-white dark:prose-strong:text-white">
        {children}
      </article>
    </div>
  );
}
