export const languages = ["en", "es"] as const;
export type Language = (typeof languages)[number];

const english = {
  skip: "Skip to content",
  product: "Staff Command Center",
  sample: "Sample",
  signIn: "Sign in",
  preview: "Preview as sample pastor",
  previewNote:
    "Sample session. It completes a sample MFA code and a step-up, and it is refused in production.",
  email: "Email",
  password: "Password",
  code: "Authentication code",
  dark: "Dark",
  light: "Light",
  language: "Language",
  signOut: "Sign out",
  locked: "Confirm it's you again before this opens.",
  empty: "Nothing here yet.",
  sendsOff: "No message is sent from this screen.",
  overview: "Overview",
  people: "People",
  import: "Import",
  duplicates: "Duplicates",
  discipleship: "Discipleship",
  care: "Care",
  tasks: "My tasks",
  playbooks: "Playbooks",
  groups: "Groups",
  events: "Events",
  checkin: "Check-in",
  serving: "Serving",
  worship: "Worship",
  kids: "Kids",
  communications: "Communications",
  push: "Push",
  facilities: "Facilities",
  giving: "Giving",
  stewardship: "Stewardship",
  finance: "Finance",
  missions: "Missions",
  media: "Media",
  integrations: "Integrations",
  capabilities: "Capabilities",
  security: "Security",
  admin: "Admin",
} as const;

const spanish: { [Key in keyof typeof english]: string } = {
  skip: "Saltar al contenido",
  product: "Centro de mando",
  sample: "Muestra",
  signIn: "Entrar",
  preview: "Vista previa como pastor de muestra",
  previewNote:
    "Sesión de muestra. Completa un código MFA de muestra y una reconfirmación, y se rechaza en producción.",
  email: "Correo",
  password: "Contraseña",
  code: "Código de autenticación",
  dark: "Oscuro",
  light: "Claro",
  language: "Idioma",
  signOut: "Salir",
  locked: "Confirma que eres tú antes de abrir esto.",
  empty: "Todavía no hay nada aquí.",
  sendsOff: "Esta pantalla no envía ningún mensaje.",
  overview: "Resumen",
  people: "Personas",
  import: "Importar",
  duplicates: "Duplicados",
  discipleship: "Discipulado",
  care: "Cuidado",
  tasks: "Mis tareas",
  playbooks: "Guías de seguimiento",
  groups: "Grupos",
  events: "Eventos",
  checkin: "Registro",
  serving: "Servicio",
  worship: "Adoración",
  kids: "Niños",
  communications: "Comunicación",
  push: "Avisos",
  facilities: "Instalaciones",
  giving: "Ofrendas",
  stewardship: "Mayordomía",
  finance: "Finanzas",
  missions: "Misiones",
  media: "Medios",
  integrations: "Integraciones",
  capabilities: "Capacidades",
  security: "Seguridad",
  admin: "Administración",
};

const catalogs = { en: english, es: spanish };

export type CopyKey = keyof typeof english;

export function isLanguage(value: string | undefined): value is Language {
  return value === "en" || value === "es";
}

export function copy(language: Language): { [Key in CopyKey]: string } {
  return catalogs[language];
}

export const navGroups = [
  { id: "home", items: ["overview"] },
  { id: "people", items: ["people", "import", "duplicates", "tasks", "care", "playbooks", "discipleship", "groups"] },
  { id: "gather", items: ["events", "checkin", "serving", "worship", "kids", "facilities"] },
  { id: "message", items: ["communications", "push", "media"] },
  { id: "money", items: ["giving", "stewardship", "finance", "missions"] },
  { id: "system", items: ["integrations", "capabilities", "security", "admin"] },
] as const;

export const sectionIds = navGroups.flatMap((group) => [...group.items]);
export type SectionId = (typeof sectionIds)[number];

export function isSectionId(value: string): value is SectionId {
  return (sectionIds as readonly string[]).includes(value);
}
