<img width="1376" height="768" alt="GymFlow preview" src="https://github.com/user-attachments/assets/02a2ed97-0147-4570-b900-0e65493e97d5" />

# GymFlow

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago-009EE3?style=flat-square&logo=mercadopago&logoColor=white)

Sistema operativo para gimnasios modernos. Gestioná socios, registrá asistencia con QR, armá planes de entrenamiento, procesá pagos y motivá a tus miembros con XP y logros — todo en una sola plataforma.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — base de datos PostgreSQL, autenticación y RLS multi-tenant
- **Tailwind CSS** + Radix UI + shadcn/ui
- **Mercado Pago** — cobro de membresías y suscripciones
- **Anthropic Claude API** — chat IA para miembros (Haiku)
- **Framer Motion** — animaciones
- **Lottie** — ilustraciones animadas

## Funcionalidades

### Gestión del gimnasio
- Registro de dueño con pago inicial vía Mercado Pago
- Multi-tenancy: cada gimnasio está aislado por `gym_id`
- Códigos de invitación para socios y entrenadores
- Panel de administración con reportes y métricas en tiempo real

### Socios y membresías
- CRM de socios con historial de asistencia y pagos
- Planes de membresía configurables (precio, duración, descripción)
- Cobro de membresías: efectivo o Mercado Pago (checkout y webhook)
- Check-in con código QR personal por socio

### Planes de entrenamiento
- Editor de planes con estructura por fases: precalentamiento, principal y estiramiento
- Configuración por serie: repeticiones (rango min-max), tiempo, porcentaje de 1RM y descanso
- Biblioteca de ejercicios con categorías, grupos musculares y modo cronometrado
- Asignación de planes a socios por entrenador

### Sesiones de entrenamiento
- Registro de sesión activa con tracking por serie (peso, reps, tiempo)
- Historial de sesiones con XP ganado

### Gamificación
- Sistema de XP y logros desbloqueables
- Progreso visible para el socio en su perfil

### Chat IA
- Asistente inteligente para socios basado en Claude Haiku
- Responde consultas sobre rutinas, nutrición y progreso
- Rate limiting y logs de conversación por gimnasio

### Notificaciones
- Sistema de notificaciones en tiempo real (Supabase Realtime)
- Alertas de renovación de membresía y logros

## Roles

| Rol | Permisos |
|-----|----------|
| Admin | Acceso completo, gestión de socios, entrenadores y pagos |
| Entrenador | Crear y asignar planes, ver socios asignados |
| Socio | Ver su plan, registrar sesiones, chat IA, ver progreso |

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Mercado Pago](https://www.mercadopago.com) (para pagos)
- API Key de [Anthropic](https://www.anthropic.com) (para chat IA)

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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Anthropic (chat IA)
ANTHROPIC_API_KEY=tu_api_key

# Mercado Pago
MP_ACCESS_TOKEN=tu_access_token
MP_WEBHOOK_SECRET=tu_webhook_secret
NEXT_PUBLIC_MP_PUBLIC_KEY=tu_public_key
```

Corré las migraciones en tu proyecto de Supabase (carpeta `supabase/migrations/`) en orden cronológico.

Iniciá el servidor de desarrollo:

```bash
npm run dev
```

## Estructura

```
app/
├── (auth)/              # Login y registro
├── (dashboard)/         # Panel principal (protegido)
│   ├── dashboard/       # Inicio con resumen y métricas
│   ├── personas/        # Gestión de socios
│   ├── planes/          # Planes de entrenamiento
│   ├── entrenamiento/   # Sesión de entrenamiento activa
│   ├── exercises/       # Biblioteca de ejercicios
│   ├── achievements/    # Logros y XP
│   ├── check-in/        # Check-in con QR
│   ├── reports/         # Reportes
│   ├── admin/           # Administración del gimnasio
│   └── profile/         # Perfil y progreso del socio
├── actions/             # Server Actions
└── api/
    ├── chat/            # Chat IA (miembro y entrenador)
    ├── mp-webhook/      # Webhook de Mercado Pago
    └── saas-webhook/    # Webhook de registro de gimnasio

components/
├── ui/                  # Componentes base (design system)
├── dashboard/           # Componentes del panel
├── members/             # Gestión de socios
├── planes/              # Editor de planes y sesión de entrenamiento
└── exercises/           # Biblioteca de ejercicios

supabase/
└── migrations/          # Migraciones de base de datos (orden cronológico)
```
