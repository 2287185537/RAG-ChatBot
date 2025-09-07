// 移除AI风格图标，保留更克制的文本标题
import Chatcontainer from "@/components/Chatcontainer";
import UpLoadContainer from "@/components/UpLoadContainer";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen w-full academic-gradient">
      {/* 顶部导航栏 */}
      <header className="glass-effect border-b border-border/50 px-8 py-5">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              AI知识库助手
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              基于RAG的学术知识检索与问答
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="flex flex-col lg:flex-row h-[calc(100vh-80px)] max-w-[1600px] mx-auto px-8 py-6 gap-8">
        {/* 左侧：文档上传区域 */}
        <aside className="lg:w-1/3 flex flex-col">
          <div className="glass-card rounded-2xl p-6 hover-lift h-full">
            <h2 className="text-base font-semibold text-foreground mb-4">文档管理</h2>
            <div className="border-t border-border/30 pt-4 h-full">
              <UpLoadContainer />
            </div>
          </div>
        </aside>

        {/* 右侧：聊天界面 */}
        <section className="lg:w-2/3 flex flex-col">
          <div className="glass-card rounded-2xl p-6 hover-lift h-full flex flex-col">
            <h2 className="text-base font-semibold text-foreground mb-4">智能问答</h2>
            <div className="border-t border-border/30 pt-4 flex-1 min-h-0">
              <Chatcontainer />
            </div>
          </div>
        </section>
      </main>

      {/* 底部装饰性元素 */}
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
    </div>
  );
}
