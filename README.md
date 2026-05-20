<img width="1376" height="768" alt="GymFlow preview" src="https://github.com/user-attachments/assets/02a2ed97-0147-4570-b900-0e65493e97d5" />

# GymFlow

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

Sistema operativo para gimnasios modernos. Gestioná socios, registrá asistencia con QR, armá planes de entrenamiento y motivá a tus miembros con XP y logros — todo en una sola plataforma.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — base de datos, autenticación y realtime
- **Tailwind CSS** + Radix UI + shadcn/ui
- **Framer Motion** — animaciones
- **Lottie** — ilustraciones animadas

## Funcionalidades

- Check-in con código QR personal por socio
- CRM de socios con historial de asistencia y membresías
- Planes de entrenamiento por entrenador/miembro
- Registro de sesiones con series, repeticiones y peso
- Sistema de XP y logros gamificado
- Biblioteca de ejercicios con categorías y grupos musculares
- Panel de análisis en tiempo real (Supabase Realtime)
- Acceso por roles: admin, entrenador y socio

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)

## Instalación

```bash
git clone https://github.com/Gopi1794/gym-saas.git
cd gym-saas
npm install
```

Copiá el archivo de variables de entorno:

```bash
cp .env.example .env.local
```

Completá las variables en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

Corré las migraciones en tu proyecto de Supabase (carpeta `supabase/migrations/`).

Iniciá el servidor de desarrollo:

```bash
npm run dev
```

## Estructura

```
app/
├── (auth)/          # Login y registro
├── (dashboard)/     # Panel principal (protegido)
│   ├── dashboard/   # Inicio con resumen
│   ├── members/     # Gestión de socios
│   ├── planes/      # Planes de entrenamiento
│   ├── exercises/   # Biblioteca de ejercicios
│   ├── sesion/      # Registro de sesión activa
│   └── profile/     # Perfil y progreso
├── actions/         # Server Actions
└── api/             # API Routes

components/
├── ui/              # Componentes base (design system)
├── dashboard/       # Componentes del panel
├── members/         # Gestión de socios
├── planes/          # Editor de planes
└── exercises/       # Biblioteca de ejercicios

supabase/
└── migrations/      # Migraciones de base de datos
```

## Roles

| Rol | Permisos |
|-----|----------|
| Admin | Acceso completo, gestión de socios y entrenadores |
| Entrenador | Crear y asignar planes, ver socios asignados |
| Socio | Ver su plan, registrar sesiones, ver progreso |
