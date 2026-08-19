# 💰 Steward

### Finanzas personales basadas en principios de mayordomía

**Steward** es una aplicación de finanzas personales diseñada para ayudar a las personas a administrar mejor sus recursos, organizar su presupuesto y tomar mejores decisiones financieras.

Permite gestionar **ingresos, gastos, presupuestos, cuentas, tarjetas, cuotas, ahorro y aportes como el diezmo**, todo desde un solo lugar.

> **Administrar bien los recursos también es una forma de construir un mejor futuro.**

---

## 📱 Disponible en App Store

Steward ya está disponible para iPhone.

### 🍎 [Descargar Steward en App Store](https://apps.apple.com/us/app/steward/id6783429254)

**Requisitos:** iOS 15.1 o superior.

---

## 🎯 ¿Qué es Steward?

Steward nace de una idea sencilla:

> **No se trata solamente de cuánto dinero tenemos, sino de cómo lo administramos.**

La aplicación busca convertir el presupuesto en un hábito sencillo y ayudar al usuario a tener una visión más clara de su situación financiera.

Con Steward puedes:

* 💰 Registrar tus ingresos.
* 🧾 Organizar tus gastos por categorías.
* 📊 Crear presupuestos mensuales.
* 🏦 Administrar múltiples cuentas.
* 💳 Registrar tarjetas y cuotas.
* 📈 Visualizar la ejecución de tu presupuesto.
* 💵 Proyectar tu ahorro mensual.
* ⛪ Configurar aportes como el diezmo.
* 🎯 Trabajar hacia una mejor planificación financiera.

---

## ✨ Funcionalidades

### 📊 Presupuesto mensual

Crea un presupuesto para cada mes y establece cómo quieres distribuir tus ingresos.

Puedes visualizar durante el mes cuánto has presupuestado y cuánto has ejecutado.

### 💵 Ingresos

Registra ingresos **fijos y variables** para tener una visión más clara del dinero disponible.

### 🧾 Gastos

Clasifica tus gastos y conoce cómo estás utilizando tus recursos.

### 🏦 Múltiples cuentas

Administra diferentes cuentas desde una misma aplicación.

### 💳 Tarjetas y cuotas

Registra tarjetas y controla las cuotas asociadas a tus compromisos financieros.

### 💰 Proyección de ahorro

Utiliza el presupuesto para proyectar cuánto puedes ahorrar durante el mes.

### ⛪ Diezmo y aportes

Steward permite configurar aportes como el diezmo dentro de la planificación financiera.

Esta funcionalidad forma parte del enfoque de **mayordomía** que inspira el proyecto.

### 💳 Gestión de créditos

Steward incluye herramientas para organizar compromisos financieros y explicar estrategias como el método de **bola de nieve para el pago de créditos**.

---

## 📸 Capturas de pantalla

Las capturas de la aplicación se encuentran en:

```text
assets/images/
```

Próximamente se incluirán aquí las principales pantallas de Steward para facilitar una vista rápida del producto.

---

## 🏗️ Tecnología

Steward está construido como una aplicación móvil utilizando tecnologías modernas del ecosistema React Native.

### Aplicación

![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square\&logo=react\&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square\&logo=expo\&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square\&logo=typescript\&logoColor=white)

* **React Native**
* **Expo**
* **TypeScript**

### Build & Deployment

* Expo Application Services (EAS)
* iOS
* App Store

---

## 🧩 Estructura del proyecto

El proyecto está organizado buscando mantener una estructura clara y facilitar su evolución a medida que se agregan nuevas funcionalidades.

```text
steward/
├── assets/
│   └── images/
├── scripts/
├── src/
├── .claude/
├── .vscode/
├── AGENTS.md
├── CLAUDE.md
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```

---

## 🚀 Ejecutar localmente

### Requisitos

Necesitas tener instalado:

* Node.js
* npm
* Expo CLI

Puedes verificar tu instalación:

```bash
node --version
npm --version
```

### Clonar el repositorio

```bash
git clone https://github.com/srdejo/steward.git
```

Entrar al proyecto:

```bash
cd steward
```

Instalar dependencias:

```bash
npm install
```

Iniciar el proyecto:

```bash
npx expo start
```

Después puedes ejecutar la aplicación utilizando Expo Go, un emulador Android o un simulador iOS.

---

## 📦 Builds

Steward utiliza **Expo Application Services (EAS)** para generar las versiones de la aplicación.

La configuración de los builds se encuentra en:

```text
eas.json
```

Para iniciar un build:

```bash
eas build
```

---

## 🗺️ Roadmap

Steward continúa evolucionando como producto.

Algunas de las áreas de desarrollo incluyen:

* [x] Presupuestos mensuales
* [x] Registro de ingresos
* [x] Registro de gastos
* [x] Categorías de gastos
* [x] Múltiples cuentas
* [x] Tarjetas y cuotas
* [x] Proyección de ahorro
* [x] Configuración de aportes
* [x] Cálculo de diezmo
* [x] Explicación del método bola de nieve
* [x] Publicación en App Store
* [ ] Mejoras de experiencia de usuario
* [ ] Nuevas herramientas de planificación financiera
* [ ] Reportes y análisis financieros
* [ ] Nuevas estrategias para gestión de créditos
* [ ] Nuevas funcionalidades de ahorro y metas

> El roadmap puede cambiar a medida que el producto evoluciona y se reciben nuevos comentarios de los usuarios.

---

## 🔐 Privacidad

Steward actualmente declara en App Store que **no recopila datos** del usuario.

Para conocer los detalles de privacidad, consulta la información publicada en la ficha de la aplicación.

---

## 🧪 Estado del proyecto

**🟢 Publicado y en desarrollo activo**

Steward ya cuenta con una versión pública disponible en la App Store y continúa evolucionando con nuevas funcionalidades, mejoras y correcciones.

### Última versión publicada

**v1.0.2**

Entre las mejoras recientes se encuentran:

* Correcciones relacionadas con presupuestos de meses diferentes al actual.
* Cálculo correcto de fechas de vencimiento de cuotas según el período seleccionado.
* Selección de moneda según el país.
* Mejoras relacionadas con la gestión de créditos.
* Explicación del método de bola de nieve.
* Correcciones generales.

---

## 💡 Filosofía

El nombre **Steward** viene del concepto de *stewardship*, entendido como la responsabilidad de administrar correctamente los recursos que tenemos.

Por eso el objetivo de la aplicación no es solamente registrar gastos.

Busca ayudar a responder preguntas como:

> ¿En qué estoy utilizando mis recursos?

> ¿Estoy cumpliendo mis prioridades?

> ¿Cuánto puedo ahorrar?

> ¿Estoy preparado para mis compromisos?

> ¿Estoy avanzando hacia mis objetivos?

La tecnología es una herramienta para facilitar una mejor administración.

---

## 🤝 Contribuciones

Steward es actualmente un proyecto personal.

Si encuentras un problema o tienes una sugerencia, puedes utilizar los **Issues** del repositorio para reportarlo o proponer una mejora.

Las contribuciones serán consideradas a medida que el proyecto evolucione.

---

## 📄 Licencia

Este proyecto está disponible bajo la licencia **MIT**.

Consulta [LICENSE](LICENSE) para conocer los términos completos.

---

## 👨‍💻 Autor

**Daniel Jimenez**

Software Engineer · Full Stack Developer

🌐 **Website:** [srdejo.github.io](https://srdejo.github.io)

💼 **LinkedIn:** [linkedin.com/in/srdejo](https://www.linkedin.com/in/srdejo/)

🐙 **GitHub:** [github.com/srdejo](https://github.com/srdejo)

🍎 **App Store:** [Steward](https://apps.apple.com/us/app/steward/id6783429254)

---

## 🚀 Steward

**Administra bien lo que tienes. Construye hacia lo que quieres.**
