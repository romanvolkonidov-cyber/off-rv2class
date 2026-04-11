import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  ru: {
    common: {
      app: {
        name: "rv2class",
      },
      auth: {
        loginSubtitle: "Современная платформа для онлайн-обучения",
        email: "Email адрес",
        password: "Пароль",
        loginButton: "Войти в систему",
        teacherRegistration: "Регистрация для учителей",
        demoAccounts: "Демо-аккаунты:",
        demoTeacher: "Учитель: teacher@rv2class.ru",
        demoStudent: "Ученик: student@rv2class.ru",
        demoPassword: "Пароль: 123456"
      },
      common: {
        loading: "Загрузка...",
        create: "Создать",
        delete: "Удалить",
        save: "Сохранить",
        cancel: "Отмена"
      },
      admin: {
        title: "Панель администратора",
        createCourse: "Создать курс",
        createLesson: "Создать урок",
        courseName: "Название курса",
        courseDescription: "Описание курса",
        lessonName: "Название урока",
        uploadSlides: "Загрузить слайды",
        publish: "Опубликовать",
        unpublish: "Скрыть"
      }
    }
  }
};

i18n
  .use(Backend)
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
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    defaultNS: 'common',
    react: {
      useSuspense: false,
    },
  });

export default i18n;