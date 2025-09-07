'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 创建一个查询客户端实例
// 这个客户端负责管理所有的数据请求，比如缓存、重试、同步等
const queryClient = new QueryClient()

// 这个组件的作用是给整个应用提供数据查询的能力
// 就像给房子安装了一个智能管家，管理所有的数据获取和缓存
function App({ children }: { children: React.ReactNode }) {
  return (
    // 把查询客户端提供给整个应用
    // 这样所有的子组件都能使用这个客户端来获取数据
    // 就像把管家介绍给房子里的所有人认识
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export default App;