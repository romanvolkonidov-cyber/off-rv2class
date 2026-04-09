'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ru: {
    translation: {
      // App
      'app.name': 'rv2class',
      'app.tagline': 'Платформа для онлайн-обучения английскому языку',

      // Auth
      'auth.login': 'Вход',
      'auth.logout': 'Выйти',
      'auth.email': 'Email',
      'auth.password': 'Пароль',
      'auth.name': 'Имя',
      'auth.loginButton': 'Войти',
      'auth.loginTitle': 'Вход в систему',
      'auth.loginSubtitle': 'Введите данные для входа',

      // Roles
      'role.admin': 'Администратор',
      'role.teacher': 'Учитель',
      'role.student': 'Ученик',

      // Navigation
      'nav.dashboard': 'Главная',
      'nav.library': 'Библиотека уроков',
      'nav.students': 'Ученики',
      'nav.gradebook': 'Журнал оценок',
      'nav.classroom': 'Начать урок',
      'nav.homework': 'Домашние задания',
      'nav.courses': 'Курсы',
      'nav.lessons': 'Уроки',
      'nav.users': 'Пользователи',
      'nav.settings': 'Настройки',

      // Admin
      'admin.title': 'Панель администратора',
      'admin.createCourse': 'Создать курс',
      'admin.courseName': 'Название курса',
      'admin.courseDescription': 'Описание курса',
      'admin.createLesson': 'Создать урок',
      'admin.lessonName': 'Название урока',
      'admin.uploadSlides': 'Загрузить слайды',
      'admin.uploadHint': 'Перетащите PNG файлы или нажмите для выбора',
      'admin.processing': 'ИИ генерирует материалы...',
      'admin.publish': 'Опубликовать',
      'admin.unpublish': 'Снять с публикации',
      'admin.editNotes': 'Редактировать заметки учителя',
      'admin.editHomework': 'Редактировать домашнее задание',

      // Teacher
      'teacher.title': 'Рабочее пространство учителя',
      'teacher.startClass': 'Начать урок',
      'teacher.endClass': 'Завершить урок',
      'teacher.addStudent': 'Добавить ученика',
      'teacher.assignHomework': 'Назначить домашнее задание',
      'teacher.myStudents': 'Мои ученики',
      'teacher.noStudents': 'У вас пока нет учеников',
      'teacher.notes': 'Заметки учителя',
      'teacher.questions': 'Вопросы для ученика',
      'teacher.answers': 'Правильные ответы',

      // Student
      'student.title': 'Панель ученика',
      'student.joinClass': 'Войти в урок',
      'student.noActiveClass': 'Нет активного урока',
      'student.myHomework': 'Мои домашние задания',
      'student.noHomework': 'Домашних заданий пока нет',
      'student.submit': 'Сдать',
      'student.submitted': 'Сдано',
      'student.score': 'Оценка',

      // Classroom
      'classroom.slide': 'Слайд',
      'classroom.of': 'из',
      'classroom.previous': 'Назад',
      'classroom.next': 'Вперёд',
      'classroom.draw': 'Рисовать',
      'classroom.type': 'Текст',
      'classroom.erase': 'Ластик',
      'classroom.clear': 'Очистить',
      'classroom.clearConfirm': 'Вы уверены? Все рисунки будут удалены.',

      // Homework
      'homework.title': 'Домашнее задание',
      'homework.fillBlank': 'Заполните пропуск',
      'homework.multipleChoice': 'Выберите правильный ответ',
      'homework.trueFalse': 'Верно или неверно',
      'homework.shortAnswer': 'Краткий ответ',
      'homework.submitAll': 'Сдать домашнее задание',
      'homework.result': 'Результат',
      'homework.correct': 'Правильно',
      'homework.incorrect': 'Неправильно',

      // Gradebook 
      'gradebook.title': 'Журнал оценок',
      'gradebook.student': 'Ученик',
      'gradebook.lesson': 'Урок',
      'gradebook.autoScore': 'Авто-оценка',
      'gradebook.override': 'Ваша оценка',
      'gradebook.comment': 'Комментарий',
      'gradebook.submitted': 'Сдано',
      'gradebook.pending': 'Ожидает сдачи',
      'gradebook.notSubmitted': 'Не сдано',

      // Common
      'common.save': 'Сохранить',
      'common.cancel': 'Отмена',
      'common.delete': 'Удалить',
      'common.edit': 'Редактировать',
      'common.create': 'Создать',
      'common.loading': 'Загрузка...',
      'common.error': 'Ошибка',
      'common.success': 'Успешно',
      'common.noData': 'Нет данных',
      'common.back': 'Назад',
      'common.confirm': 'Подтвердить',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
