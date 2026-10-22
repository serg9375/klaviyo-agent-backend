// Short on purpose: an assistant that guessed a wrong address should learn the right one, not read a page of markup.
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        Assistants: the instructions are at <a href="/llms.txt">/llms.txt</a>. Start there.
      </p>
    </main>
  );
}
