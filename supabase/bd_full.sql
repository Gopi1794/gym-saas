-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.gyms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid,
  logo_url text,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  invite_code text NOT NULL DEFAULT "substring"(md5((gen_random_uuid())::text), 1, 8) UNIQUE,
  mp_vault_secret_id uuid,
  CONSTRAINT gyms_pkey PRIMARY KEY (id),
  CONSTRAINT gyms_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'trainer'::text, 'member'::text])),
  gym_id uuid,
  membership_type text DEFAULT 'basic'::text CHECK (membership_type = ANY (ARRAY['basic'::text, 'premium'::text, 'vip'::text])),
  membership_expires_at timestamp with time zone,
  qr_code text DEFAULT (gen_random_uuid())::text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])),
  total_xp integer NOT NULL DEFAULT 0,
  date_of_birth date,
  phone text,
  weight_kg numeric,
  height_cm integer,
  goal text CHECK (goal = ANY (ARRAY['lose_weight'::text, 'gain_muscle'::text, 'performance'::text, 'maintain'::text])),
  medical_conditions text,
  training_frequency text CHECK (training_frequency = ANY (ARRAY['never'::text, '1-2'::text, '3-4'::text, '5+'::text])),
  emergency_name text,
  emergency_phone text,
  onboarding_seen boolean NOT NULL DEFAULT false,
  notification_hour integer NOT NULL DEFAULT 7 CHECK (notification_hour >= 0 AND notification_hour <= 23),
  trainer_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT profiles_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category = ANY (ARRAY['strength'::text, 'cardio'::text, 'flexibility'::text, 'balance'::text, 'hiit'::text])),
  muscle_groups ARRAY DEFAULT '{}'::text[],
  video_url text,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  external_id text UNIQUE,
  is_timed boolean NOT NULL DEFAULT false,
  CONSTRAINT exercises_pkey PRIMARY KEY (id)
);
CREATE TABLE public.exercise_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT exercise_favorites_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gym_id uuid NOT NULL,
  checked_in_at timestamp with time zone DEFAULT now(),
  checked_out_at timestamp with time zone,
  method text DEFAULT 'qr'::text CHECK (method = ANY (ARRAY['qr'::text, 'manual'::text])),
  CONSTRAINT check_ins_pkey PRIMARY KEY (id),
  CONSTRAINT check_ins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT check_ins_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT check_ins_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.workout_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_template boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  assigned_to uuid,
  level text CHECK (level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text])),
  gym_id uuid NOT NULL,
  CONSTRAINT workout_plans_pkey PRIMARY KEY (id),
  CONSTRAINT workout_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT workout_plans_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  CONSTRAINT workout_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT workout_plans_created_by_gym_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT workout_plans_created_by_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.profiles(gym_id),
  CONSTRAINT workout_plans_assigned_to_gym_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT workout_plans_assigned_to_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.profiles(gym_id)
);
CREATE TABLE public.client_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  client_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  gym_id uuid NOT NULL,
  CONSTRAINT client_plans_pkey PRIMARY KEY (id),
  CONSTRAINT client_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT client_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id),
  CONSTRAINT client_plans_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id),
  CONSTRAINT client_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT client_plans_client_gym_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id),
  CONSTRAINT client_plans_client_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.profiles(gym_id),
  CONSTRAINT client_plans_plan_gym_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT client_plans_plan_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.workout_plans(gym_id)
);
CREATE TABLE public.workout_plan_days (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workout_plan_days_pkey PRIMARY KEY (id),
  CONSTRAINT workout_plan_days_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id)
);
CREATE TABLE public.workout_plan_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  sets smallint NOT NULL DEFAULT 3,
  reps smallint NOT NULL DEFAULT 10,
  rest_seconds smallint NOT NULL DEFAULT 60,
  order_index smallint NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  duration_seconds smallint,
  reps_max smallint,
  phase text NOT NULL DEFAULT 'main'::text CHECK (phase = ANY (ARRAY['warmup'::text, 'main'::text, 'cooldown'::text])),
  CONSTRAINT workout_plan_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT workout_plan_exercises_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.workout_plan_days(id),
  CONSTRAINT workout_plan_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.workout_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_name text NOT NULL,
  exercises_count integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  rest_skips integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  gym_id uuid NOT NULL,
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT workout_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT workout_sessions_plan_gym_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT workout_sessions_plan_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.workout_plans(gym_id),
  CONSTRAINT workout_sessions_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT workout_sessions_user_gym_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT workout_sessions_user_gym_fkey FOREIGN KEY (gym_id) REFERENCES public.profiles(gym_id)
);
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  xp_reward integer NOT NULL DEFAULT 50 CHECK (xp_reward >= 1 AND xp_reward <= 1000),
  condition_type text NOT NULL CHECK (condition_type = ANY (ARRAY['total_sessions'::text, 'streak_days'::text, 'sessions_week'::text, 'total_xp'::text, 'sessions_category'::text, 'total_volume_kg'::text, 'total_cardio_minutes'::text])),
  condition_value integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  condition_target text,
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  earned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id)
);
CREATE TABLE public.workout_session_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  exercise_id uuid,
  exercise_name text NOT NULL,
  category text NOT NULL,
  set_number integer NOT NULL,
  reps integer,
  weight_kg numeric,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  distance_meters integer,
  speed_kmh numeric,
  resistance_level smallint,
  calories_burned smallint,
  CONSTRAINT workout_session_sets_pkey PRIMARY KEY (id),
  CONSTRAINT workout_session_sets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id),
  CONSTRAINT workout_session_sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['new_member'::text, 'check_in'::text, 'achievement'::text, 'plan_assigned'::text, 'membership_expiring'::text, 'churn_alert'::text])),
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedup_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  gym_id uuid,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT notifications_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  member_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  mp_payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT payments_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.membership_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['basic'::text, 'premium'::text, 'vip'::text])),
  label text NOT NULL DEFAULT ''::text,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0::numeric),
  duration_days integer NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  features ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT membership_plans_pkey PRIMARY KEY (id),
  CONSTRAINT membership_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.chat_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gym_id uuid,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])),
  agent text NOT NULL DEFAULT 'fitness'::text,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_logs_pkey PRIMARY KEY (id),
  CONSTRAINT chat_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT chat_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.exercise_maxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  weight_kg numeric NOT NULL,
  recorded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_maxes_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_maxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT exercise_maxes_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.ai_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['generate_plan'::text, 'import_plan'::text])),
  plan_id uuid,
  input_tokens integer,
  output_tokens integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT ai_audit_logs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT ai_audit_logs_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.workout_plan_set_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL,
  set_number smallint NOT NULL,
  reps smallint,
  reps_max smallint,
  percent_1rm smallint,
  duration_seconds smallint,
  notes text,
  CONSTRAINT workout_plan_set_configs_pkey PRIMARY KEY (id),
  CONSTRAINT workout_plan_set_configs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.workout_plan_exercises(id)
);
CREATE TABLE public.foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid,
  name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  fiber numeric NOT NULL DEFAULT 0,
  sodium numeric NOT NULL DEFAULT 0,
  household_unit text,
  grams_per_unit numeric,
  sugars numeric,
  saturated_fat numeric,
  potassium numeric,
  calcium numeric,
  magnesium numeric,
  zinc numeric,
  iron numeric,
  vitamin_b12 numeric,
  CONSTRAINT foods_pkey PRIMARY KEY (id),
  CONSTRAINT foods_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id)
);
CREATE TABLE public.nutrition_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  goal text DEFAULT 'mantenimiento'::text CHECK (goal = ANY (ARRAY['volumen'::text, 'definicion'::text, 'mantenimiento'::text, 'recomposicion'::text, 'rendimiento'::text, 'perdida_moderada'::text, 'otro'::text])),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  target_calories numeric,
  target_protein numeric,
  target_carbs numeric,
  target_fat numeric,
  CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_plans_gym_id_fkey FOREIGN KEY (gym_id) REFERENCES public.gyms(id),
  CONSTRAINT nutrition_plans_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id),
  CONSTRAINT nutrition_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.nutrition_meals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  name text NOT NULL,
  time_label text,
  order_index integer NOT NULL DEFAULT 0,
  CONSTRAINT nutrition_meals_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_meals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.nutrition_plans(id)
);
CREATE TABLE public.nutrition_meal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL,
  food_id uuid NOT NULL,
  quantity_grams numeric NOT NULL DEFAULT 100,
  CONSTRAINT nutrition_meal_items_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_meal_items_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.nutrition_meals(id),
  CONSTRAINT nutrition_meal_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id)
);
CREATE TABLE public.nutrition_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  meal_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  logged_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_logs_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id),
  CONSTRAINT nutrition_logs_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.nutrition_meals(id)
);
CREATE TABLE public.water_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  glasses integer NOT NULL DEFAULT 0,
  CONSTRAINT water_logs_pkey PRIMARY KEY (id),
  CONSTRAINT water_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.weight_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL,
  notes text,
  logged_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weight_logs_pkey PRIMARY KEY (id),
  CONSTRAINT weight_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.nutrition_food_favorites (
  user_id uuid NOT NULL,
  food_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_food_favorites_pkey PRIMARY KEY (user_id, food_id),
  CONSTRAINT nutrition_food_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT nutrition_food_favorites_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id)
);
CREATE TABLE public.nutrition_log_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL,
  food_id uuid NOT NULL,
  actual_grams numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_log_items_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_log_items_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.nutrition_logs(id),
  CONSTRAINT nutrition_log_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id)
);