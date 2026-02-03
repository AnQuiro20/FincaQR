# 🐄 Sistema de Gestión Ganadera

Aplicación web para la **gestión integral de ganado**, orientada al registro, control y análisis de información clave como animales, gestación, partos, vacunas y estadísticas generales.  
El sistema está diseñado con una interfaz clara, modular y fácil de usar, priorizando la experiencia del usuario y la mantenibilidad del código.

---

## 📌 Características principales

### 🐮 Gestión de animales
- Registro de animales con validación de datos
- Clasificación por tipo (vaca, toro, ternero)
- Identificación única por ID
- Visualización en tablas con acciones rápidas

### 🤰 Gestación y partos
- Registro de animales preñados
- Control de fechas estimadas
- Historial de partos
- Organización clara de la información por estado

### 💉 Control de vacunas
- Registro de vacunas aplicadas
- Asociación de vacunas a animales
- Paginación de registros
- Estadísticas visuales por mes y tipo de animal

### 📊 Estadísticas
- Visualización gráfica de datos relevantes
- Indicadores rápidos (cards)
- Estados de carga y manejo de errores
- Actualización dinámica según los datos disponibles

### 🔐 Control de acceso
- Modo **solo lectura**
- Bloqueo visual y funcional de acciones sensibles
- Enfoque en seguridad y prevención de modificaciones no autorizadas

---

## 🧠 Experiencia de usuario (UX)
- Sistema de **toasts** para mensajes de éxito, error y advertencia
- Prevención de acciones duplicadas (doble clic)
- Interfaz por pestañas para navegación intuitiva
- Diseño responsive y consistente

---

## 🛠️ Tecnologías utilizadas

- **HTML5** – Estructura de la aplicación
- **CSS3** – Estilos modulares y diseño responsivo
- **JavaScript (Vanilla)** – Lógica de la aplicación y manejo del estado
- **Supabase** – Persistencia de datos (base de datos y consultas)
- **Canvas / Charts** – Visualización de estadísticas

> No se utilizan frameworks de frontend; el proyecto está desarrollado con JavaScript puro para un mayor control y comprensión de la lógica.

---

## 📂 Estructura del proyecto

```

/
├── index.html
├── app.js
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── forms.css
│   ├── tables.css
│   ├── modals.css
│   ├── stats.css
│   ├── vacunas.css
│   ├── prenadas.css
│   └── autentificacion.css
└── README.md

````

---

## ⚙️ Instalación y uso

1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
````

2. Abrir el proyecto:

https://anquiro20.github.io/FincaQR/

* La base de datos en Suphabase se encuntra desabilitada.
  
3. Configurar Supabase:

* Crear un proyecto en Supabase
* Configurar las tablas necesarias
* Colocar las credenciales en `app.js`

---

## 📈 Estado del proyecto

* ✅ Funcional
* 🔧 En mejora continua
* 📦 Pensado para escalar y refactorizar en módulos

---

## 🚀 Posibles mejoras futuras

* Separación completa del JavaScript en módulos
* Autenticación robusta con Supabase Auth
* Roles de usuario (admin / lectura)
* Exportación avanzada de reportes
* Optimización del manejo de estado global

---

## 👨‍💻 Autor

**Andrés Quirós**

Estudiante de Ingeniería en Computación

Instituto Tecnológico de Costa Rica (TEC)

---

