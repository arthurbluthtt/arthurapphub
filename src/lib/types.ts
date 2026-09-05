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
  tags?: string[];
  featured?: boolean;
  /** Si true, la app participa del flujo SSO; si no, se accede directamente. */
  sso?: boolean;
}

export interface AppsData {
  categories: Category[];
  apps: App[];
}
