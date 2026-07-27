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
  icon: string;
  category: string;
  tags: string[];
  featured?: boolean;
  /** Si true, abre en la misma pestaña. Default false (abre nueva pestaña). */
  sameTab?: boolean;
}

export interface AppsData {
  categories: Category[];
  apps: App[];
}
