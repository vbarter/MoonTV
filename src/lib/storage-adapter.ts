// 存储适配器 - 处理 Tauri 环境下的本地存储
// 在 Tauri 环境中，localStorage 仍然可用，但我们可以添加额外的处理逻辑

export class StorageAdapter {
  private static instance: StorageAdapter;

  private constructor() {}

  static getInstance(): StorageAdapter {
    if (!StorageAdapter.instance) {
      StorageAdapter.instance = new StorageAdapter();
    }
    return StorageAdapter.instance;
  }

  // 检查是否在 Tauri 环境中
  private isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && (window as any).__TAURI__;
  }

  // 获取存储项
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('获取存储项失败:', error);
      return null;
    }
  }

  // 设置存储项
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('设置存储项失败:', error);
    }
  }

  // 删除存储项
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('删除存储项失败:', error);
    }
  }

  // 清空所有存储
  clear(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.clear();
    } catch (error) {
      console.error('清空存储失败:', error);
    }
  }

  // 检查存储是否可用
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例实例
export const storageAdapter = StorageAdapter.getInstance();
