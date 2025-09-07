'use client';

import React from 'react'
import {useDropzone} from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// 定义文件模型类型
interface FileModel {
  id: string;
  file_name: string;
  // 用于后端删除：已经在上传时写入了 file_key
  file_key: string;
  file_path?: string;
  upload_time?: string;
}

type Props = {}

const UpLoadContainer = (props: Props) => {
  const queryClient = useQueryClient(); // 获取 queryClient 实例

  // 查询文件列表
  const {data: filesResponse, isLoading} = useQuery({
    queryKey: ['files'], 
    queryFn: async () => {
      const response = await axios.post('/api/getfiles');
      return response.data; // 返回响应数据而不是整个响应对象
    }
  });

  // 文件上传功能 - 使用 React Query 的 useMutation
  const {mutate, isPending, isSuccess, isError} = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post('/api/upload', formData);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('文件上传成功:', data);
      // 刷新文件列表
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error) => {
      console.error('文件上传失败:', error);
    }
  });

  // 删除文件：调用 /api/delete 按 file_key 删除 Pinecone 向量与数据库记录
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (file_key: string) => {
      const resp = await axios.post('/api/delete', { file_key });
      return resp.data;
    },
    onSuccess: () => {
      // 删除成功后刷新文件列表
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (error) => {
      console.error('删除失败:', error);
    },
    onSettled: () => {
      setDeletingKey(null);
    }
  });

  // 处理文件拖拽
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      mutate(acceptedFiles[0]);
    }
  }, [mutate]);

  
  const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop});

  // 从响应中提取文件数组
  const files = filesResponse?.files || filesResponse || [];

  return (
    <div className="h-full w-full flex flex-col">
      {/* 上传区域 */}
      <div 
        {...getRootProps()} 
        className={`
          glass-card rounded-2xl p-8 mb-6 cursor-pointer
          transition-all duration-300 ease-in-out hover-lift
          flex flex-col items-center justify-center min-h-[200px]
          ${isDragActive 
            ? 'ring-2 ring-primary ring-offset-2 bg-primary/5 scale-105' 
            : 'hover:bg-accent/5'
          }
        `}
      >
        <input {...getInputProps()} />
        
        {/* 纯文本头部 */}
        <div className="mb-2 text-sm font-medium text-muted-foreground">上传文档</div>

        {/* 文字提示 */}
        <div className="text-center mb-4">
          {isDragActive ? (
            <p className="text-base font-medium text-primary">
              释放文件以上传
            </p>
          ) : (
            <>
              <p className="text-base font-medium text-foreground mb-2">
                拖拽文档到这里
              </p>
              <p className="text-sm text-muted-foreground">
                或者点击选择文件
              </p>
            </>
          )}
        </div>

        {/* 支持的文件类型提示 */}
        <div className="text-xs text-muted-foreground text-center">
          支持 PDF、DOC、DOCX、TXT 等格式
          <br />
          最大文件大小: 10MB
        </div>
      </div>

      {/* 上传状态显示 */}
      {(isPending || isSuccess || isError) && (
        <div className="glass-card rounded-xl p-4 mb-4 text-sm text-foreground">
          {isPending && <span>正在上传文件...</span>}
          {isSuccess && <span>文件上传成功！</span>}
          {isError && <span>文件上传失败，请重试</span>}
        </div>
      )}

      {/* 文件列表显示 */}
      <div className="flex-1 overflow-hidden">
        <h3 className="text-base font-semibold text-foreground mb-4">已上传文档</h3>
        
        <div className="h-full overflow-y-auto scrollbar-academic">
          {isLoading ? (
            <div className="glass-card rounded-xl p-4 text-center">
              <div className="animate-pulse flex items-center justify-center space-x-2">
                <div className="w-4 h-4 bg-accent rounded-full animate-bounce"></div>
                <span className="text-sm text-muted-foreground">正在获取文件...</span>
              </div>
            </div>
          ) : files && files.length > 0 ? (
            <div className="space-y-3">
              {files.map((file: FileModel) => (
                <div key={file.id} className="glass-card rounded-xl p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.file_name}
                        </p>
                        {file.upload_time && (
                          <p className="text-xs text-muted-foreground mt-1">{file.upload_time}</p>
                        )}
                      </div>
                    </div>
                    {/* 操作按钮：删除 */}
                    <button
                      onClick={() => {
                        setDeletingKey(file.file_key);
                        deleteMutation.mutate(file.file_key);
                      }}
                      disabled={deleteMutation.isPending || deletingKey === file.file_key}
                      className="px-3 py-1 text-sm rounded-md border border-border/50 hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="删除该文档"
                    >
                      {deleteMutation.isPending && deletingKey === file.file_key ? '删除中…' : '删除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">暂无文档</p>
              <p className="text-xs text-muted-foreground mt-1">上传文档开始构建您的知识库</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpLoadContainer