export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-black dark:border-zinc-800 dark:border-t-white" />
    </div>
  );
}
