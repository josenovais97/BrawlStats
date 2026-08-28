import Image from "next/image";

/**
 * The shared shape of the two whole-page dead ends: a 404, and a render that
 * threw.
 *
 * One component because they are the same moment from the reader's side —
 * something they wanted is not there — and differ only in what can be offered
 * next. Splitting them produced two subtly different layouts the first time
 * they were written separately.
 *
 * The artwork carries it rather than an icon. These are the only two screens
 * on the site with nothing useful to show, so they are the two that can afford
 * to spend space on something with a bit of character.
 */
export function FullPageMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: React.ReactNode;
  /** The ways out: links, a retry button. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center sm:py-16">
      <Image
        src="/art/connection-error.png"
        alt=""
        width={460}
        height={391}
        priority
        className="h-auto w-40 sm:w-52"
      />
      <h1 className="display mt-6 text-3xl uppercase sm:text-4xl">{title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{body}</p>
      {children ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
