<div align="center">

# 🐄 FincaQR — Livestock Management System

### A responsive web application for organizing livestock operations

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=000)
![Supabase](https://img.shields.io/badge/Database-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![HTML5](https://img.shields.io/badge/Frontend-HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![Status](https://img.shields.io/badge/Status-Functional-success?style=flat-square)

[View the interface](https://anquiro20.github.io/FincaQR/)

</div>

FincaQR is a web-based livestock management system for recording, organizing, and analyzing operational information about animals, pregnancies, births, vaccinations, and herd statistics.

The application was built with vanilla JavaScript to explore state management, data validation, cloud persistence, responsive interface design, and real-world CRUD workflows without relying on a frontend framework.

> The public interface is available through GitHub Pages. Its original Supabase database is currently disabled, so cloud-backed operations require a separate Supabase configuration.

## Core Features

### Animal Records

- register animals with data validation
- classify cows, bulls, and calves
- assign unique identifiers
- browse records in tables with quick actions

### Pregnancy and Birth Tracking

- register pregnant animals
- track estimated dates
- maintain birth history
- organize records by current status

### Vaccination Management

- associate vaccinations with individual animals
- paginate vaccination records
- visualize monthly and animal-type statistics

### Dashboard and Reporting

- summary cards for key indicators
- visual statistics based on available data
- loading and error states
- dynamic updates after data changes

### Access Control

- read-only mode
- visual and functional blocking of sensitive actions
- safeguards against accidental modifications

## User Experience

- toast notifications for success, warning, and error states
- duplicate-action prevention
- tab-based navigation
- responsive layout for desktop and mobile
- modular CSS organized by interface responsibility

## Architecture

```text
FincaQR/
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
```

## Tech Stack

- **HTML5** for semantic structure
- **CSS3** for responsive, modular styling
- **Vanilla JavaScript** for application logic and state management
- **Supabase** for database persistence and queries
- **Canvas-based charts** for operational statistics

## Run Locally

```bash
git clone https://github.com/AnQuiro20/FincaQR.git
cd FincaQR
```

Open `index.html` in a browser, or start a small local server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

To enable cloud persistence, create a Supabase project, reproduce the required tables, and configure the project credentials used by the application.

## Engineering Improvements Planned

- split the main JavaScript file into focused modules
- add robust authentication with Supabase Auth
- introduce administrator and read-only roles
- add advanced report exports
- improve global state management
- add automated tests and continuous integration

## Author

**Andrés Quirós Rojas**  
Computer Engineering Student — Tecnológico de Costa Rica

[GitHub Profile](https://github.com/AnQuiro20) · [Portfolio](https://anquiro20.github.io/Mi_portafolio/) · [LinkedIn](https://www.linkedin.com/in/andres-quirós-b769a0366)
