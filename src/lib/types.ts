export interface Category {
  id: string;
  label: string;
  color: string;
}

export interface App {
  id: string;
  name: string;
  description: string;
  url: string;
  redir?: string;
  icon: string;
  category: string;
  tags: string[];
  featured?: boolean;
}

export interface AppsData {
  categories: Category[];
  apps: App[];
}
