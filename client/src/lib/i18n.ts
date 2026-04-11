import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    common: {
      app: { name: "rv2class" },
      auth: {
        loginSubtitle: "A modern platform for online learning",
        registerSubtitle: "Create a teacher portal for your students",
        email: "Email address",
        password: "Password",
        name: "Your Name",
        loginButton: "Sign In",
        teacherRegistration: "Teacher Registration",
        alreadyHaveAccount: "Already have an account? Sign In",
        demoAccounts: "Demo accounts:",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        rights: "All rights reserved."
      },
      common: { loading: "Loading..." }
    }
  },
  ru: {
    common: {
      app: { name: "rv2class" },
      auth: {
        loginSubtitle: "Современная платформа для онлайн-обучения",
        registerSubtitle: "Создайте портал учителя для своих учеников",
        email: "Email адрес",
        password: "Пароль",
        name: "Ваше имя",
        loginButton: "Войти в систему",
        teacherRegistration: "Регистрация для учителей",
        alreadyHaveAccount: "Уже есть аккаунт? Войти",
        demoAccounts: "Демо-аккаунты:",
        privacy: "Политика конфиденциальности",
        terms: "Пользовательское соглашение",
        rights: "Все права защищены."
      },
      common: { loading: "Загрузка..." }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en'],
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    defaultNS: 'common',
    react: {
      useSuspense: false,
    },
  });

export default i18n;