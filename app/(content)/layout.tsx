import { TopBar } from "@/components/shell/top-bar";

export default function ContentLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pt-6 pb-16 md:pt-10">{children}</main>
    </div>
  );
}
