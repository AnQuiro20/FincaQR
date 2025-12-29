// ================= SUPABASE CLIENT =================
const { createClient } = supabase;

const supabaseClient = createClient(
    'https://kuipquqixbgphvsnnoku.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1aXBxdXFpeGJncGh2c25ub2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTE0MTAsImV4cCI6MjA4MjM4NzQxMH0.zU6NitwVOHvIYfuGvdrSauu5sFwves40vQI-sQXKvGw'
);

// ================= VARIABLES GLOBALES =================
let ultimaOperacion = null;
let datosPendientes = null;
let tipoFormularioActual = null;
let animalesCargados = [];
let animalesFiltrados = [];
let paginaActual = 1;
const itemsPorPagina = 10;
let charts = {};
let animalAEliminar = null;
let animalEditando = null;
let modoEdicion = false;
let vacasPrenadas = [];
let prenadaEditando = null;
let historialPartos = [];
let historialFiltrado = [];
let paginaHistorialActual = 1;
const itemsPorPaginaHistorial = 10;

// ================= UTILIDADES DE VALIDACIÓN Y SEGURIDAD =================
function sanitizarTexto(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}

function sanitizarNumero(numero) {
    if (!numero && numero !== 0) return null;
    const num = parseInt(numero);
    return isNaN(num) ? null : num;
}

function validarFecha(fechaStr) {
    if (!fechaStr) return { valida: false, mensaje: 'Fecha vacía' };
    
    try {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) {
            return { valida: false, mensaje: 'Fecha inválida' };
        }
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fecha > hoy) {
            return { valida: false, mensaje: 'Fecha no puede ser futura' };
        }
        
        if (fecha < new Date('1900-01-01')) {
            return { valida: false, mensaje: 'Fecha muy antigua' };
        }
        
        return { valida: true, fecha: fecha };
    } catch (error) {
        return { valida: false, mensaje: 'Error procesando fecha' };
    }
}

function validarRango(numero, min, max, campo) {
    if (numero === null || numero === undefined) {
        return { valida: true, valor: null }; // Campos opcionales
    }
    
    const num = parseInt(numero);
    if (isNaN(num)) {
        return { valida: false, mensaje: `${campo} debe ser un número` };
    }
    
    if (num < min || num > max) {
        return { valida: false, mensaje: `${campo} debe estar entre ${min} y ${max}` };
    }
    
    return { valida: true, valor: num };
}

function validarLongitud(texto, maxLength, campo) {
    if (!texto) return { valida: true, valor: '' };
    
    if (texto.length > maxLength) {
        return { 
            valida: false, 
            mensaje: `${campo} no debe exceder ${maxLength} caracteres` 
        };
    }
    
    return { valida: true, valor: texto };
}

function escaparEntrada(valor) {
    if (typeof valor !== 'string') return valor;
    
    return valor
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function validarFormatoId(id) {
    if (!id && id !== 0) {
        return { valida: false, mensaje: 'ID es requerido' };
    }
    
    const idNum = parseInt(id);
    if (isNaN(idNum)) {
        return { valida: false, mensaje: 'ID debe ser un número' };
    }
    
    if (idNum <= 0) {
        return { valida: false, mensaje: 'ID debe ser mayor que 0' };
    }
    
    if (idNum > 999999) {
        return { valida: false, mensaje: 'ID demasiado grande' };
    }
    
    return { valida: true, valor: idNum };
}

async function ejecutarConTimeout(promise, tiempoMs = 10000, mensajeError = 'Tiempo de espera agotado') {
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(mensajeError)), tiempoMs)
    );
    
    return Promise.race([promise, timeout]);
}

async function verificarConexionSupabase() {
    try {
        const { data, error } = await ejecutarConTimeout(
            supabaseClient.from('animales').select('count').limit(1),
            5000,
            'Timeout al conectar con la base de datos'
        );
        
        if (error) throw error;
        return { conectado: true };
    } catch (error) {
        console.error('Error de conexión:', error);
        return { 
            conectado: false, 
            mensaje: error.message || 'Error de conexión con la base de datos' 
        };
    }
}

// ================= SISTEMA DE MENSAJES =================
function mostrarError(titulo, mensaje, detalles = '') {
    cerrarAdvertencia();
    document.getElementById('error-title').textContent = titulo;
    document.getElementById('error-text').textContent = mensaje;
    
    const detallesElement = document.getElementById('error-details');
    if (detalles) {
        detallesElement.textContent = detalles;
        detallesElement.style.display = 'block';
    } else {
        detallesElement.style.display = 'none';
    }
    
    document.getElementById('error-message').classList.remove('hidden');
    const errorContent = document.querySelector('.error-content');
    errorContent.classList.add('shake');
    setTimeout(() => errorContent.classList.remove('shake'), 500);
}

function cerrarError() {
    document.getElementById('error-message').classList.add('hidden');
}

function reintentarOperacion() {
    cerrarError();
    if (ultimaOperacion && datosPendientes) {
        setTimeout(() => ultimaOperacion(...datosPendientes), 300);
    }
}

function mostrarAdvertencia(titulo, mensaje, detalles = '', callbackContinuar = null) {
    document.getElementById('warning-title').textContent = titulo;
    document.getElementById('warning-text').textContent = mensaje;
    
    const detallesElement = document.getElementById('warning-details');
    if (detalles) {
        detallesElement.textContent = detalles;
        detallesElement.style.display = 'block';
    } else {
        detallesElement.style.display = 'none';
    }
    
    window.continuarOperacion = callbackContinuar || function() { cerrarAdvertencia(); };
    
    const btnContinuar = document.querySelector('#warning-message .btn-error-primary');
    if (btnContinuar && callbackContinuar) {
        btnContinuar.onclick = () => callbackContinuar();
    }
    
    const btnCancelar = document.querySelector('#warning-message .btn-error-secondary');
    if (btnCancelar) btnCancelar.onclick = cerrarAdvertencia;
    
    document.getElementById('warning-message').classList.remove('hidden');
}

function cerrarAdvertencia() {
    document.getElementById('warning-message').classList.add('hidden');
    window.continuarOperacion = null;
}

function continuarOperacion() {
    if (window.continuarOperacion && typeof window.continuarOperacion === 'function') {
        window.continuarOperacion();
    }
    cerrarAdvertencia();
}

function mostrarLoading(mensaje = 'Procesando...') {
    document.getElementById('loading-text').textContent = mensaje;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function ocultarLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function mostrarConfirmacion(mensaje) {
    cerrarAdvertencia();
    cerrarError();
    document.getElementById('confirmation-text').textContent = mensaje;
    document.getElementById('confirmation-message').classList.remove('hidden');
    
    setTimeout(() => {
        const confirmacion = document.getElementById('confirmation-message');
        if (confirmacion && !confirmacion.classList.contains('hidden')) cerrarConfirmacion();
    }, 3000);
}

function cerrarConfirmacion() {
    document.getElementById('confirmation-message').classList.add('hidden');
    if (document.getElementById('tab-registro').classList.contains('active')) ocultarFormularios();
}

// ================= VALIDACIONES EN TIEMPO REAL =================
async function validarIdUnico(id, tipoAnimal) {
    try {
        const { data, error } = await supabaseClient
            .from('animales')
            .select('id')
            .eq('id', parseInt(id));
        
        if (error) throw error;
        
        return {
            disponible: data.length === 0,
            mensaje: data.length === 0 ? 'ID disponible' : `ID ya registrado para otro animal`
        };
    } catch (error) {
        console.error('Error validando ID:', error);
        return { disponible: false, mensaje: 'Error validando ID' };
    }
}

async function validarPadreMadre(id, tipo) {
    try {
        const { data, error } = await supabaseClient
            .from('animales')
            .select('id, tipo')
            .eq('id', parseInt(id));
        
        if (error) throw error;
        
        if (data.length === 0) return { existe: false, mensaje: `${tipo} no encontrado` };
        
        const animal = data[0];
        const tipoEsperado = tipo === 'Padre' ? 'Toro' : 'Vaca';
        
        if (animal.tipo !== tipoEsperado) {
            return { 
                existe: false, 
                mensaje: `El ID ${id} pertenece a un ${animal.tipo.toLowerCase()}, no a un ${tipoEsperado.toLowerCase()}`
            };
        }
        
        return { existe: true, mensaje: `${tipo} válido` };
    } catch (error) {
        console.error('Error validando padre/madre:', error);
        return { existe: false, mensaje: 'Error validando' };
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function validarCampoId(input, campoId) {
    const valor = input.value.trim();
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    
    formGroup.classList.remove('error', 'success');
    const mensajeAnterior = formGroup.querySelector('.error-text, .success-text, .validation-badge');
    if (mensajeAnterior) mensajeAnterior.remove();
    
    if (!valor) {
        formGroup.classList.remove('error', 'success');
        return;
    }
    
    if (isNaN(valor) || parseInt(valor) <= 0) {
        marcarError(formGroup, 'El ID debe ser un número mayor que 0');
        return;
    }
    
    const badge = document.createElement('div');
    badge.className = 'validation-badge checking';
    badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    formGroup.appendChild(badge);
    setTimeout(() => badge.classList.add('show'), 10);
    
    try {
        const resultado = await validarIdUnico(valor, obtenerTipoAnimalPorCampo(campoId));
        badge.remove();
        
        if (resultado.disponible) {
            formGroup.classList.add('success');
            const successBadge = document.createElement('div');
            successBadge.className = 'validation-badge available show';
            successBadge.innerHTML = `<i class="fas fa-check-circle"></i> ${resultado.mensaje}`;
            formGroup.appendChild(successBadge);
        } else {
            formGroup.classList.add('error');
            const errorBadge = document.createElement('div');
            errorBadge.className = 'validation-badge taken show';
            errorBadge.innerHTML = `<i class="fas fa-times-circle"></i> ${resultado.mensaje}`;
            formGroup.appendChild(errorBadge);
        }
    } catch (error) {
        badge.remove();
        marcarError(formGroup, 'Error verificando disponibilidad del ID');
    }
}

async function validarPadreMadreCampo(input, tipo) {
    const valor = input.value.trim();
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    
    formGroup.classList.remove('error', 'success');
    const mensajeAnterior = formGroup.querySelector('.error-text, .success-text');
    if (mensajeAnterior) mensajeAnterior.remove();
    
    if (!valor) return;
    
    if (isNaN(valor) || parseInt(valor) <= 0) {
        marcarError(formGroup, `El ID del ${tipo.toLowerCase()} debe ser un número válido`);
        return;
    }
    
    try {
        const resultado = await validarPadreMadre(valor, tipo);
        
        if (resultado.existe) {
            formGroup.classList.add('success');
            const successMsg = document.createElement('div');
            successMsg.className = 'success-text';
            successMsg.innerHTML = `<i class="fas fa-check-circle"></i> ${resultado.mensaje}`;
            formGroup.appendChild(successMsg);
        } else {
            formGroup.classList.add('error');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-text';
            errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${resultado.mensaje}`;
            formGroup.appendChild(errorMsg);
        }
    } catch (error) {
        marcarError(formGroup, `Error validando ${tipo.toLowerCase()}`);
    }
}

function obtenerTipoAnimalPorCampo(campoId) {
    if (campoId.startsWith('v_')) return 'Vaca';
    if (campoId.startsWith('t_')) return 'Toro';
    if (campoId.startsWith('te_')) return 'Ternero';
    return 'Animal';
}

function marcarError(formGroup, mensaje) {
    formGroup.classList.add('error');
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-text';
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
    formGroup.appendChild(errorMsg);
}

// ================= VALIDACIÓN DE CAMPOS MEJORADA =================
async function validarCamposVaca() {
    const errores = [];
    const advertencias = [];
    
    // Validar ID
    const id = document.getElementById('v_id').value;
    const validacionId = validarFormatoId(id);
    if (!validacionId.valida) {
        errores.push(validacionId.mensaje);
        marcarCampoError('v_id', validacionId.mensaje);
    } else {
        // Verificar unicidad solo si el formato es válido
        try {
            const { disponible, mensaje } = await validarIdUnico(id, 'Vaca');
            if (!disponible) {
                errores.push(mensaje);
                marcarCampoError('v_id', mensaje);
            }
        } catch (error) {
            advertencias.push('No se pudo verificar la disponibilidad del ID');
        }
    }
    
    // Validar raza
    const raza = sanitizarTexto(document.getElementById('v_raza').value);
    const validacionRaza = validarLongitud(raza, 50, 'Raza');
    if (!validacionRaza.valida) {
        errores.push(validacionRaza.mensaje);
        marcarCampoError('v_raza', validacionRaza.mensaje);
    }
    
    // Validar nombre
    const nombre = sanitizarTexto(document.getElementById('v_nombre').value);
    if (nombre) {
        const validacionNombre = validarLongitud(nombre, 100, 'Nombre');
        if (!validacionNombre.valida) {
            errores.push(validacionNombre.mensaje);
            marcarCampoError('v_nombre', validacionNombre.mensaje);
        }
    }
    
    // Validar edad
    const edad = document.getElementById('v_edad').value;
    if (edad) {
        const validacionEdad = validarRango(edad, 0, 30, 'Edad');
        if (!validacionEdad.valida) {
            errores.push(validacionEdad.mensaje);
            marcarCampoError('v_edad', validacionEdad.mensaje);
        }
    }
    
    // Validar partos
    const partos = document.getElementById('v_partos').value;
    if (partos) {
        const validacionPartos = validarRango(partos, 0, 50, 'Número de partos');
        if (!validacionPartos.valida) {
            errores.push(validacionPartos.mensaje);
            marcarCampoError('v_partos', validacionPartos.mensaje);
        }
    }
    
    // Validar observaciones
    const obs = sanitizarTexto(document.getElementById('v_obs').value);
    if (obs) {
        const validacionObs = validarLongitud(obs, 500, 'Observaciones');
        if (!validacionObs.valida) {
            errores.push(validacionObs.mensaje);
            marcarCampoError('v_obs', validacionObs.mensaje);
        }
    }
    
    // Manejar resultados
    if (errores.length > 0) {
        mostrarAdvertencia('Validación de Vaca', 
            'Por favor corrige los siguientes errores:', 
            errores.join('\n'));
        return false;
    }
    
    if (advertencias.length > 0) {
        console.warn('Advertencias durante validación:', advertencias);
    }
    
    return true;
}

async function validarCamposToro() {
    const id = document.getElementById('t_id').value;
    const raza = document.getElementById('t_raza').value;
    const errores = [];
    
    if (!id.trim()) {
        errores.push('El ID es obligatorio');
        marcarCampoError('t_id', 'ID requerido');
    } else if (isNaN(id) || parseInt(id) <= 0) {
        errores.push('El ID debe ser un número válido mayor que 0');
        marcarCampoError('t_id', 'ID inválido');
    }
    
    if (!raza.trim()) {
        errores.push('La raza es obligatoria');
        marcarCampoError('t_raza', 'Raza requerida');
    }
    
    const edad = document.getElementById('t_edad').value;
    if (edad && (isNaN(edad) || parseInt(edad) < 0 || parseInt(edad) > 20)) {
        errores.push('La edad debe estar entre 0 y 20 años');
        marcarCampoError('t_edad', 'Edad inválida');
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia('Validación de Toro', 'Por favor corrige los siguientes errores:', errores.join('\n'));
        return false;
    }
    
    return true;
}

async function validarCamposTernero() {
    const id = document.getElementById('te_id').value;
    const raza = document.getElementById('te_raza').value;
    const errores = [];
    
    if (!id.trim()) {
        errores.push('El ID es obligatorio');
        marcarCampoError('te_id', 'ID requerido');
    } else if (isNaN(id) || parseInt(id) <= 0) {
        errores.push('El ID debe ser un número válido mayor que 0');
        marcarCampoError('te_id', 'ID inválido');
    }
    
    if (!raza.trim()) {
        errores.push('La raza es obligatoria');
        marcarCampoError('te_raza', 'Raza requerida');
    }
    
    const fecha = document.getElementById('te_fecha').value;
    if (fecha) {
        const fechaNacimiento = new Date(fecha);
        const hoy = new Date();
        if (fechaNacimiento > hoy) {
            errores.push('La fecha de nacimiento no puede ser futura');
            marcarCampoError('te_fecha', 'Fecha inválida');
        }
    }
    
    const padre = document.getElementById('te_padre').value;
    if (padre) {
        if (isNaN(padre) || parseInt(padre) <= 0) {
            errores.push('El ID del padre debe ser un número válido');
            marcarCampoError('te_padre', 'ID padre inválido');
        } else {
            const validacionPadre = await validarPadreMadre(padre, 'Padre');
            if (!validacionPadre.existe) {
                errores.push(validacionPadre.mensaje);
                marcarCampoError('te_padre', validacionPadre.mensaje);
            }
        }
    }
    
    const madre = document.getElementById('te_madre').value;
    if (madre) {
        if (isNaN(madre) || parseInt(madre) <= 0) {
            errores.push('El ID de la madre debe ser un número válido');
            marcarCampoError('te_madre', 'ID madre inválido');
        } else {
            const validacionMadre = await validarPadreMadre(madre, 'Madre');
            if (!validacionMadre.existe) {
                errores.push(validacionMadre.mensaje);
                marcarCampoError('te_madre', validacionMadre.mensaje);
            }
        }
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia('Validación de Ternero', 'Por favor corrige los siguientes errores:', errores.join('\n'));
        return false;
    }
    
    return true;
}

function marcarCampoError(campoId, mensaje) {
    const input = document.getElementById(campoId);
    const formGroup = input.closest('.form-group');
    
    if (formGroup) {
        formGroup.classList.add('error');
        const mensajeAnterior = formGroup.querySelector('.error-text');
        if (mensajeAnterior) mensajeAnterior.remove();
        
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-text';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
        formGroup.appendChild(errorMsg);
        
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
    }
}

function limpiarErrores() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error', 'success');
        const mensajes = group.querySelectorAll('.error-text, .success-text, .validation-badge');
        mensajes.forEach(msg => msg.remove());
    });
}

// ================= FUNCIONES DE GUARDADO =================
async function guardarVaca() {
    const btnGuardar = document.querySelector('#form-vaca .btn-primary');
    
    // Proteger contra múltiples clics
    if (!protegerContraClicsMultiples(btnGuardar, 3000)) {
        return;
    }
    
    try {
        // Verificar conexión primero
        const { conectado, mensaje } = await verificarConexionSupabase();
        if (!conectado) {
            mostrarError('Error de Conexión', 
                'No se pudo conectar con la base de datos',
                mensaje || 'Verifica tu conexión a internet e intenta nuevamente.');
            return;
        }
        
        limpiarErrores();
        
        if (!await validarCamposVaca()) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Vaca';
            return;
        }
        
        const id = sanitizarNumero(document.getElementById('v_id').value);
        mostrarLoading('Verificando y guardando vaca...');
        
        // Validación adicional de ID
        const validacionId = await validarIdUnico(id, 'Vaca');
        if (!validacionId.disponible) {
            ocultarLoading();
            mostrarAdvertencia('ID Duplicado', 
                'El ID ingresado ya está en uso', 
                validacionId.mensaje, 
                () => {
                    document.getElementById('v_id').focus();
                    document.getElementById('v_id').select();
                });
            return;
        }
        
        // Preparar datos sanitizados
        const datosVaca = {
            id: id,
            tipo: 'Vaca',
            raza: sanitizarTexto(document.getElementById('v_raza').value),
            nombre: sanitizarTexto(document.getElementById('v_nombre').value) || null,
            edad_aproximada: sanitizarNumero(document.getElementById('v_edad').value),
            total_partos: sanitizarNumero(document.getElementById('v_partos').value),
            observaciones: sanitizarTexto(document.getElementById('v_obs').value) || null,
            created_at: new Date().toISOString()
        };
        
        // Validar datos antes de enviar
        if (!datosVaca.raza || datosVaca.raza.length < 2) {
            throw new Error('La raza es requerida y debe tener al menos 2 caracteres');
        }
        
        // Ejecutar en transacción
        mostrarLoading('Guardando en base de datos...');
        
        const { error: errorAnimal } = await ejecutarConTimeout(
            supabaseClient.from('animales').insert([{ 
                id: datosVaca.id, 
                tipo: datosVaca.tipo 
            }]),
            10000,
            'Timeout al guardar en tabla animales'
        );
        
        if (errorAnimal) {
            // Verificar si es error de duplicado
            if (errorAnimal.code === '23505') {
                throw new Error(`El ID ${datosVaca.id} ya existe en la base de datos`);
            }
            throw new Error(`Error en tabla animales: ${errorAnimal.message}`);
        }
        
        const { error: errorVaca } = await ejecutarConTimeout(
            supabaseClient.from('vacas').insert([{
                id: datosVaca.id,
                raza: datosVaca.raza,
                nombre: datosVaca.nombre,
                edad_aproximada: datosVaca.edad_aproximada,
                total_partos: datosVaca.total_partos,
                observaciones: datosVaca.observaciones
            }]),
            10000,
            'Timeout al guardar en tabla vacas'
        );
        
        if (errorVaca) {
            // Revertir la inserción en animales si falla vacas
            await supabaseClient.from('animales').delete().eq('id', datosVaca.id);
            throw new Error(`Error en tabla vacas: ${errorVaca.message}`);
        }
        
        ocultarLoading();
        
        // Mostrar confirmación con datos seguros
        const nombreSeguro = datosVaca.nombre || 'Sin nombre';
        mostrarConfirmacion(`Vaca "${nombreSeguro}" registrada correctamente con ID: ${datosVaca.id}`);
        
        // Limpiar formulario y actualizar datos
        limpiarFormularioVaca();
        await cargarAnimales();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error crítico guardando vaca:', error);
        
        // Clasificar errores para mensajes más específicos
        let titulo = 'Error al Guardar';
        let mensaje = 'No se pudo registrar la vaca en el sistema';
        let detalles = error.message;
        
        if (error.message.includes('Timeout')) {
            titulo = 'Tiempo de Espera Agotado';
            mensaje = 'La operación está tomando demasiado tiempo';
            detalles = 'Por favor, verifica tu conexión e intenta nuevamente.';
        } else if (error.message.includes('conexión') || error.message.includes('conectar')) {
            titulo = 'Error de Conexión';
            mensaje = 'Problema de conexión con el servidor';
        } else if (error.message.includes('23505')) {
            titulo = 'ID Duplicado';
            mensaje = 'El ID ya existe en la base de datos';
        }
        
        mostrarError(titulo, mensaje, detalles);
        
        // Restaurar botón
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Vaca';
        }
    }
}

async function guardarToro() {
    limpiarErrores();
    if (!await validarCamposToro()) return;
    
    const id = document.getElementById('t_id').value;
    mostrarLoading('Verificando disponibilidad del ID...');
    
    try {
        const validacionId = await validarIdUnico(id, 'Toro');
        
        if (!validacionId.disponible) {
            ocultarLoading();
            mostrarAdvertencia('ID Duplicado', 'El ID ingresado ya está en uso', validacionId.mensaje, () => {
                document.getElementById('t_id').focus();
                document.getElementById('t_id').select();
            });
            return;
        }
        
        mostrarLoading('Guardando toro...');
        ultimaOperacion = guardarToro;
        datosPendientes = [];
        
        const { error: errorAnimal } = await supabaseClient.from('animales').insert([{ id: parseInt(id), tipo: 'Toro' }]);
        if (errorAnimal) throw new Error(`Error en tabla animales: ${errorAnimal.message}`);

        const { error: errorToro } = await supabaseClient.from('toros').insert([{
            id: parseInt(id),
            raza: document.getElementById('t_raza').value,
            nombre: document.getElementById('t_nombre').value || null,
            edad_aproximada: document.getElementById('t_edad').value ? parseInt(document.getElementById('t_edad').value) : null
        }]);
        
        if (errorToro) throw new Error(`Error en tabla toros: ${errorToro.message}`);
        
        ocultarLoading();
        const nombreToro = document.getElementById('t_nombre').value || 'Sin nombre';
        mostrarConfirmacion(`Toro "${nombreToro}" registrado correctamente con ID: ${id}`);
        limpiarFormularioToro();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarError('Error al Guardar', 'No se pudo registrar el toro en el sistema', error.message);
    }
}

async function guardarTernero() {
    limpiarErrores();
    if (!await validarCamposTernero()) return;
    
    const id = document.getElementById('te_id').value;
    mostrarLoading('Verificando disponibilidad del ID...');
    
    try {
        const validacionId = await validarIdUnico(id, 'Ternero');
        
        if (!validacionId.disponible) {
            ocultarLoading();
            mostrarAdvertencia('ID Duplicado', 'El ID ingresado ya está en uso', validacionId.mensaje, () => {
                document.getElementById('te_id').focus();
                document.getElementById('te_id').select();
            });
            return;
        }
        
        mostrarLoading('Guardando ternero...');
        ultimaOperacion = guardarTernero;
        datosPendientes = [];
        
        const { error: errorAnimal } = await supabaseClient.from('animales').insert([{ id: parseInt(id), tipo: 'Ternero' }]);
        if (errorAnimal) throw new Error(`Error en tabla animales: ${errorAnimal.message}`);

        const padreValue = document.getElementById('te_padre').value;
        const madreValue = document.getElementById('te_madre').value;
        
        const { error: errorTernero } = await supabaseClient.from('terneros').insert([{
            id: parseInt(id),
            raza: document.getElementById('te_raza').value,
            nombre: document.getElementById('te_nombre').value || null,
            genero: document.getElementById('te_genero').value,
            fecha_nacimiento: document.getElementById('te_fecha').value || null,
            padre: padreValue && !isNaN(padreValue) ? parseInt(padreValue) : null,
            madre: madreValue && !isNaN(madreValue) ? parseInt(madreValue) : null
        }]);
        
        if (errorTernero) throw new Error(`Error en tabla terneros: ${errorTernero.message}`);
        
        ocultarLoading();
        const nombreTernero = document.getElementById('te_nombre').value || 'Sin nombre';
        mostrarConfirmacion(`Ternero/a "${nombreTernero}" registrado correctamente con ID: ${id}`);
        limpiarFormularioTernero();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        mostrarError('Error al Guardar', 'No se pudo registrar el ternero en el sistema', error.message);
    }
}

// ================= FUNCIONES DE ACTUALIZACIÓN =================
async function actualizarVaca(id) {
    console.log('Actualizando vaca ID:', id);
    if (!await validarCamposVaca()) return;
    
    try {
        mostrarLoading('Actualizando vaca...');
        const datosActualizados = {
            raza: document.getElementById('v_raza').value,
            nombre: document.getElementById('v_nombre').value || null,
            edad_aproximada: document.getElementById('v_edad').value ? parseInt(document.getElementById('v_edad').value) : null,
            total_partos: document.getElementById('v_partos').value ? parseInt(document.getElementById('v_partos').value) : null,
            observaciones: document.getElementById('v_obs').value || null
        };
        
        console.log('Datos a actualizar:', datosActualizados);
        const { error } = await supabaseClient.from('vacas').update(datosActualizados).eq('id', id);
        if (error) throw error;
        
        await cargarAnimales();
        ocultarLoading();
        mostrarConfirmacion(`Vaca actualizada correctamente`);
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando vaca:', error);
        mostrarError('Error al Actualizar', 'No se pudo actualizar la vaca', error.message);
    }
}

async function actualizarToro(id) {
    console.log('Actualizando toro ID:', id);
    if (!await validarCamposToro()) return;
    
    try {
        mostrarLoading('Actualizando toro...');
        const datosActualizados = {
            raza: document.getElementById('t_raza').value,
            nombre: document.getElementById('t_nombre').value || null,
            edad_aproximada: document.getElementById('t_edad').value ? parseInt(document.getElementById('t_edad').value) : null
        };
        
        console.log('Datos a actualizar:', datosActualizados);
        const { error } = await supabaseClient.from('toros').update(datosActualizados).eq('id', id);
        if (error) throw error;
        
        await cargarAnimales();
        ocultarLoading();
        mostrarConfirmacion(`Toro actualizado correctamente`);
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando toro:', error);
        mostrarError('Error al Actualizar', 'No se pudo actualizar el toro', error.message);
    }
}

async function actualizarTernero(id) {
    console.log('Actualizando ternero ID:', id);
    if (!await validarCamposTernero()) return;
    
    try {
        mostrarLoading('Actualizando ternero...');
        const padreValue = document.getElementById('te_padre').value;
        const madreValue = document.getElementById('te_madre').value;
        
        const datosActualizados = {
            raza: document.getElementById('te_raza').value,
            nombre: document.getElementById('te_nombre').value || null,
            genero: document.getElementById('te_genero').value,
            fecha_nacimiento: document.getElementById('te_fecha').value || null,
            padre: padreValue && !isNaN(padreValue) ? parseInt(padreValue) : null,
            madre: madreValue && !isNaN(madreValue) ? parseInt(madreValue) : null
        };
        
        console.log('Datos a actualizar:', datosActualizados);
        const { error } = await supabaseClient.from('terneros').update(datosActualizados).eq('id', id);
        if (error) throw error;
        
        await cargarAnimales();
        ocultarLoading();
        mostrarConfirmacion(`Ternero actualizado correctamente`);
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando ternero:', error);
        mostrarError('Error al Actualizar', 'No se pudo actualizar el ternero', error.message);
    }
}

// ================= FUNCIONES DE INTERFAZ =================
function mostrarFormulario(tipo) {
    limpiarErrores();
    
    if (modoEdicion && tipo !== animalEditando?.tipo?.toLowerCase()) {
        const confirmar = confirm('¿Desea cancelar la edición actual? Los cambios no guardados se perderán.');
        if (confirmar) cancelarEdicion();
        else return;
    }
    
    if (!modoEdicion) {
        ocultarFormularios();
        tipoFormularioActual = tipo;
        
        const form = document.getElementById(`form-${tipo}`);
        const title = document.getElementById('form-title');
        const subtitle = document.getElementById('form-subtitle');
        
        if (form) {
            form.classList.remove('hidden');
            const nombres = { 'vaca': 'Vaca', 'toro': 'Toro', 'ternero': 'Ternero/a' };
            title.textContent = `Registrar ${nombres[tipo]}`;
            subtitle.textContent = `Completa todos los campos para registrar el ${tipo.toLowerCase()}`;
            
            document.querySelectorAll('.animal-card').forEach(card => {
                card.classList.remove('selected');
                if (card.dataset.animal === tipo) {
                    card.classList.add('selected');
                    card.style.borderColor = 'var(--primary)';
                    card.style.boxShadow = '0 8px 25px rgba(46, 125, 50, 0.2)';
                } else {
                    card.style.borderColor = '';
                    card.style.boxShadow = '';
                }
            });
            
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function ocultarFormularios() {
    console.log('Ocultando formularios');
    document.querySelectorAll('.animal-form').forEach(form => form.classList.add('hidden'));
    document.getElementById('form-title').textContent = 'Selecciona un tipo de animal';
    document.getElementById('form-subtitle').textContent = 'Haz clic en una de las tarjetas para comenzar el registro';
    document.querySelectorAll('.animal-card').forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = '';
        card.style.boxShadow = '';
    });
}

// ================= FUNCIONES DE LIMPIEZA =================
function limpiarFormularioVaca() {
    ['v_id', 'v_raza', 'v_nombre', 'v_edad', 'v_partos', 'v_obs'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.disabled = false;
        }
    });
    const btnCancelar = document.querySelector('#form-vaca #btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.remove();
}

function limpiarFormularioToro() {
    ['t_id', 't_raza', 't_nombre', 't_edad'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.disabled = false;
        }
    });
    const btnCancelar = document.querySelector('#form-toro #btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.remove();
}

function limpiarFormularioTernero() {
    ['te_id', 'te_raza', 'te_nombre', 'te_fecha', 'te_padre', 'te_madre'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.disabled = false;
        }
    });
    document.getElementById('te_genero').value = 'Macho';
    const btnCancelar = document.querySelector('#form-ternero #btn-cancelar-edicion');
    if (btnCancelar) btnCancelar.remove();
}

function limpiarTodosLosFormularios() {
    console.log('Limpiando todos los formularios');
    document.getElementById('v_id').disabled = false;
    document.getElementById('t_id').disabled = false;
    document.getElementById('te_id').disabled = false;
    
    document.getElementById('v_id').value = '';
    document.getElementById('v_raza').value = '';
    document.getElementById('v_nombre').value = '';
    document.getElementById('v_edad').value = '';
    document.getElementById('v_partos').value = '';
    document.getElementById('v_obs').value = '';
    
    document.getElementById('t_id').value = '';
    document.getElementById('t_raza').value = '';
    document.getElementById('t_nombre').value = '';
    document.getElementById('t_edad').value = '';
    
    document.getElementById('te_id').value = '';
    document.getElementById('te_raza').value = '';
    document.getElementById('te_nombre').value = '';
    document.getElementById('te_genero').value = 'Macho';
    document.getElementById('te_fecha').value = '';
    document.getElementById('te_padre').value = '';
    document.getElementById('te_madre').value = '';
}

// ================= SISTEMA DE PESTAÑAS =================
function cambiarTab(tabId) {
    console.log('Cambiando a pestaña:', tabId);
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`tab-content-${tabId}`).classList.add('active');
    
    if (tabId === 'consulta') cargarAnimales();
    else if (tabId === 'estadisticas') cargarEstadisticas();
    else if (tabId === 'registro') {
        limpiarTodosLosFormularios();
        restaurarBotonesOriginales();
    }
    else if (tabId === 'prenadas') cargarPrenadas();
    else if (tabId === 'historial') cargarHistorialPartos();
}

// ================= GESTIÓN DE ANIMALES REGISTRADOS =================
async function cargarAnimales() {
    mostrarLoading('Cargando animales registrados...');
    
    try {
        const { data: animales, error: errorAnimales } = await supabaseClient
            .from('animales')
            .select('*')
            .order('id', { ascending: true });
        
        if (errorAnimales) throw errorAnimales;
        
        const animalesCompletos = await Promise.all(animales.map(async (animal) => {
            let detalles = {};
            try {
                switch (animal.tipo) {
                    case 'Vaca':
                        const { data: vaca } = await supabaseClient.from('vacas').select('*').eq('id', animal.id).single();
                        detalles = vaca || {};
                        break;
                    case 'Toro':
                        const { data: toro } = await supabaseClient.from('toros').select('*').eq('id', animal.id).single();
                        detalles = toro || {};
                        break;
                    case 'Ternero':
                        const { data: ternero } = await supabaseClient.from('terneros').select('*').eq('id', animal.id).single();
                        detalles = ternero || {};
                        break;
                }
            } catch (error) {
                console.warn(`Error cargando detalles para animal ${animal.id}:`, error);
            }
            
            return {
                ...animal,
                ...detalles,
                fecha_prenada: animal.created_at ? new Date(animal.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }) : 'No registrada'
            };
        }));
        
        animalesCargados = animalesCompletos;
        animalesFiltrados = [...animalesCompletos];
        actualizarEstadisticasRapidas();
        renderizarTabla();
        
    } catch (error) {
        console.error('Error cargando animales:', error);
        document.getElementById('animals-table-body').innerHTML = `
            <tr><td colspan="8" class="no-data"><i class="fas fa-exclamation-triangle"></i> Error cargando datos: ${error.message}</td></tr>
        `;
        animalesCargados = [];
        animalesFiltrados = [];
        actualizarEstadisticasRapidas();
    } finally {
        ocultarLoading();
    }
}

function actualizarEstadisticasRapidas() {
    const vacas = animalesCargados.filter(a => a.tipo === 'Vaca').length;
    const toros = animalesCargados.filter(a => a.tipo === 'Toro').length;
    const terneros = animalesCargados.filter(a => a.tipo === 'Ternero').length;
    const total = animalesCargados.length;
    
    document.getElementById('stat-vacas').textContent = vacas;
    document.getElementById('stat-toros').textContent = toros;
    document.getElementById('stat-terneros').textContent = terneros;
    document.getElementById('stat-total').textContent = total;
}

function filtrarAnimales() {
    const busqueda = document.getElementById('search-input').value.toLowerCase();
    const tipoFiltro = document.getElementById('filter-type').value;
    const orden = document.getElementById('sort-by').value;
    
    let resultados = animalesCargados.filter(animal => {
        const coincideBusqueda = animal.id.toString().includes(busqueda) ||
            (animal.nombre && animal.nombre.toLowerCase().includes(busqueda)) ||
            (animal.raza && animal.raza.toLowerCase().includes(busqueda));
        const coincideTipo = tipoFiltro === 'all' || animal.tipo === tipoFiltro;
        return coincideBusqueda && coincideTipo;
    });
    
    resultados.sort((a, b) => {
        switch (orden) {
            case 'id': return a.id - b.id;
            case 'id-desc': return b.id - a.id;
            case 'nombre': return (a.nombre || '').localeCompare(b.nombre || '');
            case 'fecha': return new Date(b.created_at) - new Date(a.created_at);
            default: return 0;
        }
    });
    
    animalesFiltrados = resultados;
    paginaActual = 1;
    renderizarTabla();
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('sort-by').value = 'id';
    animalesFiltrados = [...animalesCargados];
    paginaActual = 1;
    renderizarTabla();
}

function renderizarTabla() {
    const tbody = document.getElementById('animals-table-body');
    if (!tbody) return;
    
    if (animalesFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="no-data"><i class="fas fa-search"></i> No se encontraron animales</td></tr>`;
        actualizarContador(0);
        actualizarPaginacion();
        return;
    }
    
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const animalesPagina = animalesFiltrados.slice(inicio, fin);
    
    const filasHTML = animalesPagina.map(animal => {
        const tipoClass = animal.tipo.toLowerCase();
        const infoEspecifica = obtenerInfoEspecifica(animal);
        const nombreSeguro = (animal.nombre || animal.tipo).replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        return `
            <tr>
                <td><strong>#${animal.id}</strong></td>
                <td><span class="animal-type ${tipoClass}"><i class="fas fa-${getAnimalIcon(animal.tipo)}"></i>${animal.tipo}</span></td>
                <td>${animal.nombre || 'Sin nombre'}</td>
                <td>${animal.raza || 'No especificada'}</td>
                <td>${animal.edad_aproximada ? animal.edad_aproximada + ' años' : 'N/A'}</td>
                <td>${infoEspecifica}</td>
                <td>${animal.fecha_prenada || 'N/A'}</td>
                <td>
                    <div class="animal-actions">
                        <button class="btn-action btn-view" onclick="verDetalles(${animal.id})" title="Ver detalles"><i class="fas fa-eye"></i> Ver</button>
                        <button class="btn-action btn-edit" onclick="editarAnimal(${animal.id})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-delete" onclick="eliminarAnimal(${animal.id}, '${nombreSeguro}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = filasHTML;
    actualizarContador(animalesFiltrados.length);
    actualizarPaginacion();
}

function getAnimalIcon(tipo) {
    switch (tipo) {
        case 'Vaca': return 'cow';
        case 'Toro': return 'horse-head';
        case 'Ternero': return 'horse';
        default: return 'paw';
    }
}

function obtenerInfoEspecifica(animal) {
    switch (animal.tipo) {
        case 'Vaca': return animal.total_partos ? `${animal.total_partos} partos` : 'N/A';
        case 'Toro': return animal.edad_aproximada ? `${animal.edad_aproximada} años` : 'N/A';
        case 'Ternero': return animal.genero || 'N/A';
        default: return 'N/A';
    }
}

function actualizarContador(total) {
    const inicio = (paginaActual - 1) * itemsPorPagina + 1;
    const fin = Math.min(paginaActual * itemsPorPagina, total);
    document.getElementById('table-count').textContent = `Mostrando ${inicio}-${fin} de ${total} animales`;
}

function actualizarPaginacion() {
    const totalPaginas = Math.ceil(animalesFiltrados.length / itemsPorPagina);
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    prevButton.disabled = paginaActual === 1;
    nextButton.disabled = paginaActual === totalPaginas || totalPaginas === 0;
    pageInfo.textContent = `Página ${paginaActual} de ${totalPaginas}`;
}

function cambiarPagina(direccion) {
    const totalPaginas = Math.ceil(animalesFiltrados.length / itemsPorPagina);
    const nuevaPagina = paginaActual + direccion;
    
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaActual = nuevaPagina;
        renderizarTabla();
    }
}

// ================= DETALLES DEL ANIMAL =================
async function verDetalles(id) {
    mostrarLoading('Cargando detalles...');
    
    try {
        const animal = animalesCargados.find(a => a.id === id);
        if (!animal) throw new Error('Animal no encontrado en la lista local');
        
        try {
            const { data: existe } = await supabaseClient.from('animales').select('id').eq('id', id).single();
            if (!existe) throw new Error('El animal ya no existe en la base de datos');
        } catch (error) {
            animalesCargados = animalesCargados.filter(a => a.id !== id);
            animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
            renderizarTabla();
            actualizarEstadisticasRapidas();
            throw new Error('El animal ya no existe. La lista ha sido actualizada.');
        }
        
        const detallesHTML = crearHTMLDetalles(animal);
        document.getElementById('modal-title').textContent = `Detalles: ${animal.nombre || animal.tipo} #${animal.id}`;
        document.getElementById('modal-body').innerHTML = detallesHTML;
        document.getElementById('btn-editar').onclick = () => editarAnimal(id);
        document.getElementById('animal-detail-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error cargando detalles:', error);
        if (error.message.includes('ya no existe')) mostrarConfirmacion(error.message);
        else mostrarError('Error de Detalles', 'No se pudieron cargar los detalles del animal', error.message);
    } finally {
        ocultarLoading();
    }
}

function crearHTMLDetalles(animal) {
    return `
        <div class="animal-details">
            <div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value"><strong>#${animal.id}</strong></span></div>
            <div class="detail-row"><span class="detail-label">Tipo:</span><span class="detail-value"><span class="animal-type ${animal.tipo.toLowerCase()}"><i class="fas fa-${getAnimalIcon(animal.tipo)}"></i>${animal.tipo}</span></span></div>
            <div class="detail-row"><span class="detail-label">Nombre:</span><span class="detail-value">${animal.nombre || 'Sin nombre'}</span></div>
            <div class="detail-row"><span class="detail-label">Raza:</span><span class="detail-value">${animal.raza || 'No especificada'}</span></div>
            <div class="detail-row"><span class="detail-label">Edad:</span><span class="detail-value">${animal.edad_aproximada ? animal.edad_aproximada + ' años' : 'N/A'}</span></div>
            ${animal.tipo === 'Vaca' ? `<div class="detail-row"><span class="detail-label">Total Partos:</span><span class="detail-value">${animal.total_partos || 'N/A'}</span></div>` : ''}
            ${animal.tipo === 'Ternero' ? `
            <div class="detail-row"><span class="detail-label">Género:</span><span class="detail-value">${animal.genero || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Fecha Nacimiento:</span><span class="detail-value">${animal.fecha_nacimiento || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Padre (ID):</span><span class="detail-value">${animal.padre ? '#' + animal.padre : 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Madre (ID):</span><span class="detail-value">${animal.madre ? '#' + animal.madre : 'N/A'}</span></div>
            ` : ''}
            ${animal.observaciones ? `<div class="detail-row"><span class="detail-label">Observaciones:</span><span class="detail-value">${animal.observaciones}</span></div>` : ''}
            <div class="detail-row"><span class="detail-label">Fecha Registro:</span><span class="detail-value">${animal.fecha_prenada || 'N/A'}</span></div>
        </div>
    `;
}

function cerrarModal() {
    document.getElementById('animal-detail-modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
}

function cerrarTodosLosModales() {
    const modales = [
        'animal-detail-modal',
        'modal-prenada',
        'prenada-detail-modal',
        'registro-parto-modal',
        'error-message',
        'warning-message',
        'confirmation-message'
    ];
    
    modales.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    });
}

// ================= FUNCIONES DE EDICIÓN Y ELIMINACIÓN =================
async function eliminarAnimal(id, nombre) {
    const nombreEscapado = nombre.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    mostrarAdvertencia('Confirmar Eliminación', `¿Estás seguro de eliminar al animal "${nombreEscapado}" (ID: ${id})?`,
        'Esta acción no se puede deshacer. Todos los datos del animal serán eliminados permanentemente.',
        async () => {
            try {
                cerrarAdvertencia();
                mostrarLoading('Eliminando animal...');
                
                const { data: animal, error: errorAnimal } = await supabaseClient.from('animales').select('tipo').eq('id', id).single();
                if (errorAnimal) {
                    if (errorAnimal.code === 'PGRST116') {
                        ocultarLoading();
                        animalesCargados = animalesCargados.filter(a => a.id !== id);
                        animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                        renderizarTabla();
                        actualizarEstadisticasRapidas();
                        mostrarConfirmacion(`El animal ya había sido eliminado. Lista actualizada.`);
                        return;
                    }
                    throw errorAnimal;
                }
                
                // Verificar relaciones
                if (animal.tipo === 'Ternero') {
                    const { data: ternerosComoPadre } = await supabaseClient.from('terneros').select('id').eq('padre', id);
                    const { data: ternerosComoMadre } = await supabaseClient.from('terneros').select('id').eq('madre', id);
                    if (ternerosComoPadre && ternerosComoPadre.length > 0) throw new Error('No se puede eliminar este animal porque es padre de otros terneros');
                    if (ternerosComoMadre && ternerosComoMadre.length > 0) throw new Error('No se puede eliminar este animal porque es madre de otros terneros');
                }
                
                if (animal.tipo === 'Vaca') {
                    const { data: ternerosDeVaca } = await supabaseClient.from('terneros').select('id').eq('madre', id);
                    if (ternerosDeVaca && ternerosDeVaca.length > 0) throw new Error('No se puede eliminar esta vaca porque tiene terneros registrados');
                }
                
                if (animal.tipo === 'Toro') {
                    const { data: ternerosDeToro } = await supabaseClient.from('terneros').select('id').eq('padre', id);
                    if (ternerosDeToro && ternerosDeToro.length > 0) throw new Error('No se puede eliminar este toro porque es padre de otros terneros');
                }
                
                // Eliminar de tabla específica
                let errorEspecifico = null;
                switch (animal.tipo) {
                    case 'Vaca':
                        const { error: errorVaca } = await supabaseClient.from('vacas').delete().eq('id', id);
                        errorEspecifico = errorVaca;
                        break;
                    case 'Toro':
                        const { error: errorToro } = await supabaseClient.from('toros').delete().eq('id', id);
                        errorEspecifico = errorToro;
                        break;
                    case 'Ternero':
                        const { error: errorTernero } = await supabaseClient.from('terneros').delete().eq('id', id);
                        errorEspecifico = errorTernero;
                        break;
                }
                
                if (errorEspecifico && errorEspecifico.code !== 'PGRST116') throw errorEspecifico;
                
                // Eliminar de tabla general
                const { error: errorGeneral } = await supabaseClient.from('animales').delete().eq('id', id);
                if (errorGeneral && errorGeneral.code !== 'PGRST116') throw errorGeneral;
                
                animalesCargados = animalesCargados.filter(a => a.id !== id);
                animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                ocultarLoading();
                mostrarConfirmacion(`Animal "${nombreEscapado}" eliminado correctamente.`);
                renderizarTabla();
                actualizarEstadisticasRapidas();
                
            } catch (error) {
                ocultarLoading();
                console.error('Error eliminando animal:', error);
                if (error.message.includes('No se puede eliminar')) {
                    mostrarError('No se puede eliminar', error.message, 'Este animal tiene relaciones con otros registros. Elimina primero los animales relacionados.');
                } else if (error.code === 'PGRST116') {
                    animalesCargados = animalesCargados.filter(a => a.id !== id);
                    animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                    renderizarTabla();
                    actualizarEstadisticasRapidas();
                    mostrarConfirmacion(`El animal ya había sido eliminado. Lista actualizada.`);
                } else {
                    mostrarError('Error al Eliminar', 'No se pudo eliminar el animal', error.message);
                }
            }
        }
    );
}

function limpiarReferenciaEliminacion() {
    animalAEliminar = null;
}

async function editarAnimal(id) {
    try {
        cerrarModal();
        cerrarTodosLosModales();
        console.log('Iniciando edición para ID:', id);
        
        const { data: animalBasico, error: errorBasico } = await supabaseClient.from('animales').select('*').eq('id', id).single();
        if (errorBasico) {
            console.error('Error obteniendo datos básicos:', errorBasico);
            throw new Error('Animal no encontrado');
        }
        
        console.log('Animal básico encontrado:', animalBasico);
        let detalles = {};
        const tipo = animalBasico.tipo.toLowerCase();
        
        switch (animalBasico.tipo) {
            case 'Vaca':
                const { data: vaca } = await supabaseClient.from('vacas').select('*').eq('id', id).single();
                if (vaca) detalles = vaca;
                break;
            case 'Toro':
                const { data: toro } = await supabaseClient.from('toros').select('*').eq('id', id).single();
                if (toro) detalles = toro;
                break;
            case 'Ternero':
                const { data: ternero } = await supabaseClient.from('terneros').select('*').eq('id', id).single();
                if (ternero) detalles = ternero;
                break;
        }
        
        const animalCompleto = { ...animalBasico, ...detalles };
        console.log('Datos completos del animal:', animalCompleto);
        cambiarTab('registro');
        
        setTimeout(() => mostrarFormularioEdicion(tipo, animalCompleto), 100);
        
    } catch (error) {
        console.error('Error en editarAnimal:', error);
        mostrarError('Error al editar', 'No se pudo cargar el animal para edición', error.message);
    }
}

function mostrarFormularioEdicion(tipo, datos) {
    console.log('Mostrando formulario de edición para:', tipo, datos);
    document.querySelectorAll('.animal-form').forEach(form => form.classList.add('hidden'));
    const formulario = document.getElementById(`form-${tipo}`);
    if (!formulario) {
        console.error('Formulario no encontrado:', `form-${tipo}`);
        mostrarError('Error', `No se encontró el formulario para ${tipo}`);
        return;
    }
    
    formulario.classList.remove('hidden');
    document.getElementById('form-title').textContent = `Editando ${tipo} #${datos.id}`;
    document.getElementById('form-subtitle').textContent = 'Modifica los campos que necesites';
    
    document.querySelectorAll('.animal-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.animal === tipo) card.classList.add('selected');
    });
    
    setTimeout(() => {
        rellenarCamposFormulario(tipo, datos);
        configurarBotonesEdicion(tipo, datos.id);
        formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
        formulario.classList.add('editing');
    }, 50);
}

function rellenarCamposFormulario(tipo, datos) {
    console.log('Rellenando campos para tipo:', tipo);
    switch (tipo) {
        case 'vaca':
            document.getElementById('v_id').value = datos.id;
            document.getElementById('v_id').disabled = true;
            document.getElementById('v_raza').value = datos.raza || '';
            document.getElementById('v_nombre').value = datos.nombre || '';
            document.getElementById('v_edad').value = datos.edad_aproximada || '';
            document.getElementById('v_partos').value = datos.total_partos || '';
            document.getElementById('v_obs').value = datos.observaciones || '';
            break;
        case 'toro':
            document.getElementById('t_id').value = datos.id;
            document.getElementById('t_id').disabled = true;
            document.getElementById('t_raza').value = datos.raza || '';
            document.getElementById('t_nombre').value = datos.nombre || '';
            document.getElementById('t_edad').value = datos.edad_aproximada || '';
            break;
        case 'ternero':
            document.getElementById('te_id').value = datos.id;
            document.getElementById('te_id').disabled = true;
            document.getElementById('te_raza').value = datos.raza || '';
            document.getElementById('te_nombre').value = datos.nombre || '';
            document.getElementById('te_genero').value = datos.genero || 'Macho';
            document.getElementById('te_fecha').value = datos.fecha_nacimiento || '';
            document.getElementById('te_padre').value = datos.padre || '';
            document.getElementById('te_madre').value = datos.madre || '';
            break;
    }
}

function configurarBotonesEdicion(tipo, id) {
    console.log('Configurando botones para edición de:', tipo, id);
    const btnCancelarExistente = document.getElementById('btn-cancelar-edicion');
    if (btnCancelarExistente) btnCancelarExistente.remove();
    
    const formulario = document.getElementById(`form-${tipo}`);
    const btnPrincipal = formulario.querySelector('.btn-primary');
    const formActions = formulario.querySelector('.form-actions');
    
    if (!btnPrincipal || !formActions) {
        console.error('No se encontraron botones en el formulario');
        return;
    }
    
    btnPrincipal.innerHTML = `<i class="fas fa-save"></i> Actualizar ${capitalizeFirstLetter(tipo)}`;
    switch (tipo) {
        case 'vaca': btnPrincipal.onclick = () => actualizarVaca(id); break;
        case 'toro': btnPrincipal.onclick = () => actualizarToro(id); break;
        case 'ternero': btnPrincipal.onclick = () => actualizarTernero(id); break;
    }
    
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.id = 'btn-cancelar-edicion';
    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
    btnCancelar.onclick = cancelarEdicion;
    formActions.insertBefore(btnCancelar, btnPrincipal);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function cancelarEdicion() {
    console.log('Cancelando edición');
    document.querySelectorAll('.animal-form').forEach(form => form.classList.remove('editing'));
    limpiarTodosLosFormularios();
    restaurarBotonesOriginales();
    ocultarFormularios();
    setTimeout(() => cambiarTab('consulta'), 100);
}

function restaurarBotonesOriginales() {
    console.log('Restaurando botones originales');
    const btnGuardarVaca = document.querySelector('#form-vaca .btn-primary');
    if (btnGuardarVaca) {
        btnGuardarVaca.innerHTML = '<i class="fas fa-save"></i> Guardar Vaca';
        btnGuardarVaca.onclick = guardarVaca;
    }
    
    const btnGuardarToro = document.querySelector('#form-toro .btn-primary');
    if (btnGuardarToro) {
        btnGuardarToro.innerHTML = '<i class="fas fa-save"></i> Guardar Toro';
        btnGuardarToro.onclick = guardarToro;
    }
    
    const btnGuardarTernero = document.querySelector('#form-ternero .btn-primary');
    if (btnGuardarTernero) {
        btnGuardarTernero.innerHTML = '<i class="fas fa-save"></i> Guardar Ternero';
        btnGuardarTernero.onclick = guardarTernero;
    }
    
    document.querySelectorAll('#btn-cancelar-edicion').forEach(btn => btn.remove());
}

// ================= ESTADÍSTICAS =================
async function cargarEstadisticas() {
    mostrarLoading('Cargando estadísticas...');
    
    try {
        if (animalesCargados.length === 0) await cargarAnimales();
        document.getElementById('stats-loading').style.display = 'none';
        document.getElementById('stats-grid').style.display = 'block';
        generarEstadisticas();
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        document.getElementById('stats-loading').innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>Error cargando estadísticas</p>`;
    } finally {
        ocultarLoading();
    }
}

function generarEstadisticas() {
    const tipos = ['Vaca', 'Toro', 'Ternero'];
    const conteoTipos = tipos.map(tipo => animalesCargados.filter(a => a.tipo === tipo).length);
    
    const razasCount = {};
    animalesCargados.forEach(animal => {
        if (animal.raza) razasCount[animal.raza] = (razasCount[animal.raza] || 0) + 1;
    });
    
    const razasTop = Object.entries(razasCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();
    
    const registrosEsteMes = animalesCargados.filter(animal => {
        if (!animal.created_at) return false;
        const fechaRegistro = new Date(animal.created_at);
        return fechaRegistro.getMonth() === mesActual && fechaRegistro.getFullYear() === añoActual;
    }).length;
    
    const ternerosEsteMes = animalesCargados.filter(animal => animal.tipo === 'Ternero' && animal.created_at && new Date(animal.created_at).getMonth() === mesActual).length;
    
    const animalesConEdad = animalesCargados.filter(a => a.edad_aproximada);
    const promedioEdad = animalesConEdad.length > 0 ? animalesConEdad.reduce((sum, a) => sum + a.edad_aproximada, 0) / animalesConEdad.length : 0;
    
    const vacas = animalesCargados.filter(a => a.tipo === 'Vaca');
    const vacaMasVieja = vacas.reduce((vieja, actual) => (actual.edad_aproximada || 0) > (vieja.edad_aproximada || 0) ? actual : vieja, {});
    
    const torosUsados = {};
    animalesCargados.filter(a => a.tipo === 'Ternero' && a.padre).forEach(ternero => {
        torosUsados[ternero.padre] = (torosUsados[ternero.padre] || 0) + 1;
    });
    
    const toroPrincipalId = Object.keys(torosUsados).reduce((a, b) => torosUsados[a] > torosUsados[b] ? a : b, null);
    const toroPrincipal = animalesCargados.find(a => a.id === parseInt(toroPrincipalId));
    
    const ultimoRegistro = animalesCargados.filter(a => a.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    document.getElementById('month-registrations').textContent = registrosEsteMes;
    document.getElementById('month-calves').textContent = ternerosEsteMes;
    document.getElementById('avg-age').textContent = promedioEdad.toFixed(1) + ' años';
    document.getElementById('oldest-cow').textContent = vacaMasVieja.nombre ? `${vacaMasVieja.nombre} (${vacaMasVieja.edad_aproximada} años)` : 'N/A';
    document.getElementById('main-bull').textContent = toroPrincipal ? `${toroPrincipal.nombre || 'Toro'} #${toroPrincipal.id}` : 'N/A';
    document.getElementById('last-registration').textContent = ultimoRegistro ? `${ultimoRegistro.tipo} #${ultimoRegistro.id}` : 'N/A';
    
    crearGraficos(conteoTipos, razasTop);
}

function crearGraficos(conteoTipos, razasTop) {
    Object.values(charts).forEach(chart => { if (chart) chart.destroy(); });
    charts = {};
    
    const colores = { Vaca: '#2e7d32', Toro: '#ff9800', Ternero: '#2196f3' };
    
    // Gráfico de distribución por tipo
    const ctxTipo = document.getElementById('chart-type-distribution').getContext('2d');
    charts.tipo = new Chart(ctxTipo, {
        type: 'pie',
        data: {
            labels: ['Vacas', 'Toros', 'Terneros'],
            datasets: [{
                data: conteoTipos,
                backgroundColor: [colores.Vaca, colores.Toro, colores.Ternero],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico de razas más comunes
    const ctxRazas = document.getElementById('chart-breeds').getContext('2d');
    charts.razas = new Chart(ctxRazas, {
        type: 'bar',
        data: {
            labels: razasTop.map(r => r[0]),
            datasets: [{
                label: 'Cantidad',
                data: razasTop.map(r => r[1]),
                backgroundColor: razasTop.map((_, i) => `hsl(${i * 60}, 70%, 60%)`),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    // Gráfico de evolución de registros
    const ctxEvolucion = document.getElementById('chart-registration-trend').getContext('2d');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const registrosMensuales = new Array(12).fill(0);
    
    animalesCargados.forEach(animal => {
        if (animal.created_at) {
            const fecha = new Date(animal.created_at);
            const mes = fecha.getMonth();
            registrosMensuales[mes]++;
        }
    });
    
    charts.evolucion = new Chart(ctxEvolucion, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'Registros por Mes',
                data: registrosMensuales,
                borderColor: colores.Vaca,
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

function exportarDatos() {
    if (animalesCargados.length === 0) {
        mostrarAdvertencia('Sin Datos', 'No hay animales registrados para exportar.', 'Registra algunos animales primero para poder exportar los datos.');
        return;
    }
    
    const headers = ['ID', 'Tipo', 'Nombre', 'Raza', 'Edad', 'Género', 'Fecha Nacimiento', 'Padre', 'Madre', 'Partos', 'Observaciones', 'Fecha Registro'];
    const csvData = animalesCargados.map(animal => [
        animal.id, animal.tipo, animal.nombre || '', animal.raza || '', animal.edad_aproximada || '',
        animal.genero || '', animal.fecha_nacimiento || '', animal.padre || '', animal.madre || '',
        animal.total_partos || '', animal.observaciones ? `"${animal.observaciones.replace(/"/g, '""')}"` : '', animal.fecha_prenada || ''
    ]);
    
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `ganado_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarConfirmacion('Datos exportados correctamente como CSV.');
}

// ================= SISTEMA DE PRENADAS =================
async function mostrarFormularioPrenada() {
    console.log("Mostrando formulario de prenada...");
    const modal = document.getElementById('modal-prenada');
    
    if (!modal) {
        mostrarError("Error", "No se encontró el modal de prenada");
        return;
    }
    
    mostrarLoading("Cargando lista de vacas...");
    
    try {
        // Cargar vacas desde Supabase
        const { data: vacas, error } = await supabaseClient
            .from('vacas')
            .select('id, nombre, raza, edad_aproximada')
            .order('nombre');
        
        if (error) throw error;
        
        // Limpiar y llenar el select de vacas
        const selectVaca = document.getElementById('p_vaca');
        if (!selectVaca) {
            throw new Error("No se encontró el select de vacas (p_vaca)");
        }
        
        selectVaca.innerHTML = '<option value="">Selecciona una vaca</option>';
        
        if (vacas && vacas.length > 0) {
            vacas.forEach(vaca => {
                const option = document.createElement('option');
                option.value = vaca.id;
                option.textContent = `#${vaca.id} - ${vaca.nombre || 'Sin nombre'} (${vaca.raza || 'Sin raza'})`;
                selectVaca.appendChild(option);
            });
        } else {
            selectVaca.innerHTML = '<option value="">No hay vacas registradas</option>';
        }
        
        // Cargar toros para el padre
        await cargarTorosParaPrenada();
        
        // Configurar fecha actual por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const fechaInput = document.getElementById('p_fecha');
        if (fechaInput) {
            fechaInput.value = hoy;
            fechaInput.max = hoy; // No permitir fechas futuras
            fechaInput.min = '2000-01-01';
        }
        
        // Calcular fecha estimada de parto
        calcularFechaPartoPrenada(hoy);
        
        // Mostrar modal
        modal.classList.remove('hidden');
        ocultarLoading();
        
        console.log("Formulario de prenada cargado exitosamente");
        
    } catch (error) {
        ocultarLoading();
        console.error("Error cargando formulario de prenada:", error);
        mostrarError("Error al cargar el formulario", error.message);
    }
}

function calcularFechaPartoPrenada(fechaMonta) {
    if (!fechaMonta) return;
    
    try {
        const fecha = new Date(fechaMonta);
        fecha.setDate(fecha.getDate() + 283); // Gestación bovina: ~283 días
        
        const fechaParto = fecha.toISOString().split('T')[0];
        
        // Actualizar UI
        const fechaPartoElement = document.getElementById('fecha-parto-estimado');
        const diasGestacionElement = document.getElementById('dias-gestacion');
        
        if (fechaPartoElement) {
            fechaPartoElement.textContent = fechaParto;
        }
        
        if (diasGestacionElement) {
            const hoy = new Date();
            const fechaMontaObj = new Date(fechaMonta);
            const dias = Math.floor((hoy - fechaMontaObj) / (1000 * 60 * 60 * 24));
            diasGestacionElement.textContent = dias > 0 ? dias : 0;
        }
        
        // Configurar evento para recalcular cuando cambie la fecha
        const fechaInput = document.getElementById('p_fecha');
        if (fechaInput) {
            fechaInput.addEventListener('change', function() {
                calcularFechaPartoPrenada(this.value);
            });
        }
        
    } catch (error) {
        console.error("Error calculando fecha de parto:", error);
    }
}

async function cargarTorosParaPrenada() {
    try {
        const { data: toros, error } = await supabaseClient
            .from('toros')
            .select('id, nombre, raza')
            .order('nombre');
        
        if (error) throw error;
        
        const selectToro = document.getElementById('p_toro');
        if (selectToro) {
            selectToro.innerHTML = '<option value="">Seleccionar toro (opcional)</option>';
            
            if (toros && toros.length > 0) {
                toros.forEach(toro => {
                    const option = document.createElement('option');
                    option.value = toro.id;
                    option.textContent = `#${toro.id} - ${toro.nombre || 'Sin nombre'} (${toro.raza || 'Sin raza'})`;
                    selectToro.appendChild(option);
                });
            } else {
                selectToro.innerHTML = '<option value="">No hay toros registrados</option>';
            }
        }
    } catch (error) {
        console.error('Error cargando toros:', error);
    }
}

function validarFormularioPrenada() {
    const vacaId = document.getElementById('p_vaca').value;
    const fechaPrenada = document.getElementById('p_fecha').value;
    const toroId = document.getElementById('p_toro').value;
    const observaciones = document.getElementById('p_obs').value;
    
    const errores = [];
    
    // Validar vaca
    if (!vacaId) {
        errores.push('Debe seleccionar una vaca');
        document.getElementById('p_vaca').classList.add('error');
    } else {
        document.getElementById('p_vaca').classList.remove('error');
    }
    
    // Validar fecha
    if (!fechaPrenada) {
        errores.push('La fecha de monta/inseminación es obligatoria');
        document.getElementById('p_fecha').classList.add('error');
    } else {
        document.getElementById('p_fecha').classList.remove('error');
        
        // Validar que la fecha no sea futura
        const fecha = new Date(fechaPrenada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día
        
        if (fecha > hoy) {
            errores.push('La fecha de monta no puede ser futura');
            document.getElementById('p_fecha').classList.add('error');
        }
        
        // Validar que la fecha no sea muy antigua
        const fechaMinima = new Date('2000-01-01');
        if (fecha < fechaMinima) {
            errores.push('La fecha de monta no puede ser anterior al año 2000');
            document.getElementById('p_fecha').classList.add('error');
        }
    }
    
    // Validar toro (opcional, pero si se ingresa debe ser número válido)
    if (toroId && (isNaN(toroId) || parseInt(toroId) <= 0)) {
        errores.push('El ID del toro debe ser un número válido mayor que 0');
        document.getElementById('p_toro').classList.add('error');
    } else {
        document.getElementById('p_toro').classList.remove('error');
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia(
            'Validación de Prenada',
            'Por favor corrige los siguientes errores:',
            errores.join('\n')
        );
        return false;
    }
    
    return {
        vaca_id: parseInt(vacaId),
        fecha_prenada: fechaPrenada,
        toro_padre: toroId ? parseInt(toroId) : null,
        observaciones: observaciones.trim() || null,
        estado: 'Prenada'
    };
}

async function registrarPrenada() {
    console.log("Iniciando registro de prenada...");
    
    // Validar formulario
    const datos = validarFormularioPrenada();
    if (!datos) {
        console.log("Validación fallida");
        return;
    }
    
    console.log("Datos validados:", datos);
    
    try {
        mostrarLoading('Verificando y registrando prenada...');
        
        // Verificar si la vaca ya está prenada (estado activo)
        const { data: prenadaExistente, error: errorExistente } = await supabaseClient
            .from('prenadas')
            .select('id, estado')
            .eq('vaca_id', datos.vaca_id)
            .in('estado', ['Prenada', 'En proceso'])
            .single();
        
        if (prenadaExistente && !errorExistente) {
            ocultarLoading();
            mostrarAdvertencia(
                'Vaca ya preñada',
                'Esta vaca ya tiene un registro de preñez activo',
                `La vaca #${datos.vaca_id} ya está registrada como preñada. No se puede registrar otra preñez hasta que finalice la actual.`,
                () => {
                    // Opcional: Redirigir a ver detalles de la prenada existente
                    // verDetallesPrenada(prenadaExistente.id);
                }
            );
            return;
        }
        
        // Calcular fecha estimada de parto (282 días = ~9 meses y 12 días)
        const fechaPrenada = new Date(datos.fecha_prenada);
        const fechaPartoEstimada = new Date(fechaPrenada);
        fechaPartoEstimada.setDate(fechaPrenada.getDate() + 282);
        
        datos.fecha_parto_estimada = fechaPartoEstimada.toISOString().split('T')[0];
        datos.created_at = new Date().toISOString();
        
        console.log("Datos a insertar:", datos);
        
        // Insertar en la base de datos
        const { data, error } = await supabaseClient
            .from('prenadas')
            .insert([datos])
            .select()
            .single();
        
        if (error) {
            console.error("Error de Supabase:", error);
            throw new Error(`Error al insertar en la base de datos: ${error.message}`);
        }
        
        console.log("Prenada registrada exitosamente:", data);
        ocultarLoading();
        
        // Mostrar confirmación
        const fechaPartoFormateada = formatearFecha(datos.fecha_parto_estimada);
        mostrarConfirmacion(`¡Prenada registrada exitosamente! Parto estimado: ${fechaPartoFormateada}`);
        
        // Cerrar modal y limpiar formulario
        cerrarModalPrenada();
        
        // Actualizar lista si estamos en la pestaña de prenadas
        if (document.getElementById('tab-content-prenadas')?.classList.contains('active')) {
            await cargarPrenadas();
        }
        
        // Actualizar estadísticas rápidas
        await cargarAnimales();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error registrando prenada:', error);
        
        // Mensajes de error específicos
        let mensajeError = 'No se pudo registrar la prenada';
        let detallesError = error.message;
        
        if (error.message.includes('violates foreign key constraint')) {
            mensajeError = 'Error de referencia';
            detallesError = 'La vaca o toro seleccionado no existe en la base de datos';
        } else if (error.message.includes('duplicate key')) {
            mensajeError = 'Registro duplicado';
            detallesError = 'Ya existe una prenada registrada con estos datos';
        }
        
        mostrarError(
            mensajeError,
            detallesError
        );
    }
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    try {
        const fecha = new Date(fechaISO);
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return 'Fecha inválida';
    }
}

async function cargarPrenadas() {
    const tbody = document.getElementById('prenadas-table-body');
    
    if (!tbody) {
        console.error("Elemento prenadas-table-body no encontrado");
        return;
    }
    
    mostrarLoading('Cargando prenadas...');
    
    try {
        // Obtener todas las prenadas activas
        const { data: prenadas, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza, edad_aproximada),
                toros (id, nombre, raza)
            `)
            .in('estado', ['Prenada', 'En proceso'])
            .order('fecha_parto_estimada', { ascending: true });
        
        if (error) throw error;
        
        // Actualizar estadísticas
        actualizarEstadisticasPrenadas(prenadas);
        
        // Limpiar tabla
        tbody.innerHTML = '';
        
        if (!prenadas || prenadas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No hay vacas preñadas registradas</td></tr>';
            ocultarLoading();
            return;
        }
        
        // Llenar tabla
        const hoy = new Date();
        
        prenadas.forEach(prenada => {
            const tr = document.createElement('tr');
            
            // Calcular días hasta el parto
            let diasRestantes = 0;
            let estadoTexto = '';
            let claseFila = '';
            
            if (prenada.fecha_parto_estimada) {
                const fechaParto = new Date(prenada.fecha_parto_estimada);
                diasRestantes = Math.ceil((fechaParto - hoy) / (1000 * 60 * 60 * 24));
                
                if (diasRestantes < 0) {
                    claseFila = 'retrasada';
                    estadoTexto = `Retrasada ${Math.abs(diasRestantes)} días`;
                } else if (diasRestantes <= 7) {
                    claseFila = 'proximo';
                    estadoTexto = `Muy pronto (${diasRestantes} días)`;
                } else if (diasRestantes <= 14) {
                    claseFila = 'proximo';
                    estadoTexto = `Próximo (${diasRestantes} días)`;
                } else {
                    estadoTexto = `Faltan ${diasRestantes} días`;
                }
            }
            
            tr.className = claseFila;
            
            // Información de la vaca
            const vacaInfo = prenada.vacas || {};
            const toroInfo = prenada.toros || {};
            
            tr.innerHTML = `
                <td>#${vacaInfo.id || prenada.vaca_id}</td>
                <td>${vacaInfo.nombre || 'Sin nombre'}</td>
                <td>${vacaInfo.raza || 'N/A'}</td>
                <td>${vacaInfo.edad_aproximada || 'N/A'} años</td>
                <td>${formatearFecha(prenada.fecha_prenada)}</td>
                <td>
                    ${formatearFecha(prenada.fecha_parto_estimada)}
                    ${estadoTexto ? `<br><small>(${estadoTexto})</small>` : ''}
                </td>
                <td>${toroInfo.id ? `#${toroInfo.id} - ${toroInfo.nombre || 'Sin nombre'}` : 'N/A'}</td>
                <td>
                    <div class="animal-actions">
                        <button class="btn-action btn-view" onclick="verDetallesPrenada(${prenada.id})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-edit" onclick="marcarParto(${prenada.id})" title="Registrar parto">
                            <i class="fas fa-baby"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="cancelarPrenada(${prenada.id}, '${vacaInfo.nombre || 'Vaca'}')" title="Cancelar prenada">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // Actualizar contador
        document.getElementById('prenadas-count').textContent = `${prenadas.length} vaca(s) preñada(s)`;
        
        ocultarLoading();
        
    } catch (error) {
        console.error("Error cargando prenadas:", error);
        tbody.innerHTML = '<tr><td colspan="8" class="no-data error">Error al cargar las prenadas</td></tr>';
        ocultarLoading();
    }
}

function actualizarEstadisticasPrenadas(prenadas) {
    if (!prenadas || prenadas.length === 0) {
        document.getElementById('stat-prenadas-total').textContent = '0';
        document.getElementById('stat-prenadas-cercanas').textContent = '0';
        document.getElementById('stat-prenadas-retrasadas').textContent = '0';
        return;
    }
    
    const hoy = new Date();
    let cercanas = 0;
    let retrasadas = 0;
    
    prenadas.forEach(prenada => {
        if (prenada.fecha_parto_estimada) {
            const fechaParto = new Date(prenada.fecha_parto_estimada);
            const diasRestantes = Math.ceil((fechaParto - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes < 0) {
                retrasadas++;
            } else if (diasRestantes <= 14) {
                cercanas++;
            }
        }
    });
    
    document.getElementById('stat-prenadas-total').textContent = prenadas.length;
    document.getElementById('stat-prenadas-cercanas').textContent = cercanas;
    document.getElementById('stat-prenadas-retrasadas').textContent = retrasadas;
}

function cerrarModalPrenada() {
    const modal = document.getElementById('modal-prenada');
    if (modal) {
        modal.classList.add('hidden');
        
        // Limpiar formulario
        const form = document.getElementById('form-prenada');
        if (form) {
            form.reset();
        }
        
        // Resetear información calculada
        const fechaPartoElement = document.getElementById('fecha-parto-estimado');
        const diasGestacionElement = document.getElementById('dias-gestacion');
        
        if (fechaPartoElement) fechaPartoElement.textContent = '--/--/----';
        if (diasGestacionElement) diasGestacionElement.textContent = '0';
    }
}

// ================= FUNCIONES DE PRENADAS =================
async function sugerirIdsConsecutivos(prenadaId) {
    try {
        // Obtener el último ID de ternero registrado
        const { data: ultimoTernero } = await supabaseClient
            .from('animales')
            .select('id')
            .eq('tipo', 'Ternero')
            .order('id', { ascending: false })
            .limit(1)
            .single();
        
        let siguienteId = ultimoTernero ? ultimoTernero.id + 1 : 4001;
        
        // Sugerir IDs consecutivos para cada ternero
        const totalTerneros = parseInt(document.getElementById('parto-total').value) || 1;
        for (let i = 1; i <= totalTerneros; i++) {
            const idInput = document.getElementById(`te_id_${i}`);
            idInput.value = siguienteId;
            siguienteId++;
            
            // Validar automáticamente
            setTimeout(() => validarIdTernero(i), 100);
        }
        
    } catch (error) {
        console.error('Error obteniendo último ID:', error);
    }
}

async function marcarParto(prenadaId) {
    console.log("Marcando parto para prenada ID:", prenadaId);
    
    try {
        // Obtener información de la prenada
        const { data: prenada, error: errorPrenada } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza),
                toros (id, nombre)
            `)
            .eq('id', prenadaId)
            .single();
        
        if (errorPrenada) throw errorPrenada;
        if (!prenada) throw new Error('Prenada no encontrada');
        
        // Guardar ID en input oculto
        document.getElementById('parto-prenada-id').value = prenadaId;
        
        // Mostrar información en el modal
        const vacaNombre = prenada.vacas?.nombre || `Vaca #${prenada.vaca_id}`;
        document.getElementById('parto-vaca-nombre').textContent = vacaNombre;
        document.getElementById('parto-fecha-estimada').textContent = 
            formatearFecha(prenada.fecha_parto_estimada) || 'No estimada';
        
        // Configurar fecha actual por defecto
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('parto-fecha').value = hoy;
        document.getElementById('parto-fecha').max = hoy;
        document.getElementById('parto-fecha').min = prenada.fecha_prenada;
        
        // Resetear valores
        document.getElementById('parto-total').value = 1;
        document.getElementById('parto-muertos').value = 0;
        document.getElementById('parto-obs').value = '';
        
        // Actualizar formularios de terneros
        actualizarFormulariosTerneros();
        
        // Sugerir IDs consecutivos
        sugerirIdsConsecutivos(prenadaId);
        
        // Mostrar modal
        document.getElementById('registro-parto-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error("Error al preparar registro de parto:", error);
        mostrarError('Error', 'No se pudo cargar la información de la prenada', error.message);
    }
}

function cerrarModalParto() {
    document.getElementById('registro-parto-modal').classList.add('hidden');
    document.getElementById('parto-prenada-id').value = '';
    
    // Limpiar formularios de terneros
    const container = document.getElementById('terneros-container');
    const formularios = container.querySelectorAll('.ternero-form');
    formularios.forEach(form => form.remove());
}

function precargarDatosVaca(prenada) {
    if (!prenada.vacas) return;
    
    const totalTerneros = parseInt(document.getElementById('parto-total').value) || 1;
    const razaVaca = prenada.vacas.raza || 'Desconocida';
    
    for (let i = 1; i <= totalTerneros; i++) {
        const razaInput = document.getElementById(`te_raza_${i}`);
        if (razaInput && !razaInput.value) {
            razaInput.value = razaVaca;
        }
    }
}

async function confirmarRegistroParto() {
    const prenadaId = document.getElementById('parto-prenada-id').value;
    const fechaParto = document.getElementById('parto-fecha').value;
    const ternerosMuertos = parseInt(document.getElementById('parto-muertos').value) || 0;
    const observaciones = document.getElementById('parto-obs').value.trim();
    const terneros = obtenerDatosTerneros();
    const ternerosVivos = terneros.length;
    
    // Validaciones
    if (!fechaParto) {
        mostrarAdvertencia('Validación', 'La fecha del parto es obligatoria');
        return;
    }
    
    if (ternerosVivos === 0 && ternerosMuertos === 0) {
        mostrarAdvertencia('Validación', 'Debe registrar al menos un ternero (vivo o muerto)');
        return;
    }
    
    // Validar que todos los IDs sean únicos
    const ids = terneros.map(t => t.id);
    const idsUnicos = new Set(ids);
    if (ids.length !== idsUnicos.size) {
        mostrarAdvertencia('Validación', 'Los IDs de los terneros deben ser únicos');
        return;
    }
    
    // Validar cada ID individualmente
    let todosIdsValidos = true;
    for (let i = 0; i < terneros.length; i++) {
        const inputId = document.getElementById(`te_id_${i + 1}`);
        if (inputId.classList.contains('ternero-id-invalid')) {
            todosIdsValidos = false;
            break;
        }
    }
    
    if (!todosIdsValidos) {
        mostrarAdvertencia('Validación', 'Algunos IDs de terneros no son válidos. Por favor verifica.');
        return;
    }
    
    try {
        mostrarLoading('Registrando parto y terneros...');
        
        // 1. Obtener información de la prenada
        const { data: prenada, error: errorPrenada } = await supabaseClient
            .from('prenadas')
            .select('*, vacas(id, nombre, raza), toros(id, nombre)')
            .eq('id', prenadaId)
            .single();
        
        if (errorPrenada) throw errorPrenada;
        
        // 2. Actualizar estado de la prenada
        const datosActualizacion = {
            estado: 'Finalizada',
            fecha_parto: fechaParto,
            terneros_vivos: ternerosVivos,
            terneros_muertos: ternerosMuertos,
            observaciones_partos: observaciones || null,
            created_at: new Date().toISOString()
        };
        
        const { error: errorUpdate } = await supabaseClient
            .from('prenadas')
            .update(datosActualizacion)
            .eq('id', prenadaId);
        
        if (errorUpdate) throw errorUpdate;
        
        // 3. Registrar cada ternero vivo
        const ternerosRegistrados = [];
        for (const ternero of terneros) {
            try {
                // Insertar en tabla general
                const { error: errorAnimal } = await supabaseClient
                    .from('animales')
                    .insert([{ 
                        id: ternero.id, 
                        tipo: 'Ternero',
                        created_at: new Date().toISOString()
                    }]);
                
                if (errorAnimal) throw errorAnimal;
                
                // Insertar en tabla específica
                const { error: errorTernero } = await supabaseClient
                    .from('terneros')
                    .insert([{
                        id: ternero.id,
                        raza: ternero.raza || prenada.vacas?.raza || 'Desconocida',
                        nombre: ternero.nombre,
                        genero: ternero.genero,
                        fecha_nacimiento: fechaParto,
                        padre: prenada.toro_padre || null,
                        madre: prenada.vaca_id
                    }]);
                
                if (errorTernero) throw errorTernero;
                
                ternerosRegistrados.push(ternero);
                
            } catch (error) {
                console.error(`Error registrando ternero ${ternero.id}:`, error);
                // Continuar con los demás terneros
            }
        }
        
        // 4. Actualizar número de partos de la vaca
        if (prenada.vacas) {
            const { data: vacaActual } = await supabaseClient
                .from('vacas')
                .select('total_partos')
                .eq('id', prenada.vaca_id)
                .single();
            
            const nuevosPartos = (vacaActual?.total_partos || 0) + 1;
            
            await supabaseClient
                .from('vacas')
                .update({ total_partos: nuevosPartos })
                .eq('id', prenada.vaca_id);
        }
        
        ocultarLoading();
        cerrarModalParto();
        
        // Mostrar resumen detallado
        let mensaje = `
            Parto registrado exitosamente:
            • Fecha: ${formatearFecha(fechaParto)}
            • Terneros vivos: ${ternerosVivos}
            • Terneros muertos: ${ternerosMuertos}
        `;
        
        if (ternerosRegistrados.length > 0) {
            mensaje += `\n\nTerneros registrados:`;
            ternerosRegistrados.forEach(t => {
                mensaje += `\n• #${t.id} - ${t.nombre} (${t.genero}, ${t.raza})`;
            });
        }
        
        if (observaciones) {
            mensaje += `\n\nObservaciones: ${observaciones}`;
        }
        
        mostrarConfirmacion(mensaje);
        
        // 5. Actualizar listas
        await cargarPrenadas();
        await cargarAnimales();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error registrando parto:', error);
        
        // Manejar error de columnas faltantes
        if (error.message.includes('fecha_parto')) {
            mostrarError(
                'Error de Base de Datos',
                'Falta la columna fecha_parto',
                'Por favor, agrega esta columna a la tabla prenadas en Supabase:\n\n' +
                'ALTER TABLE prenadas ADD COLUMN fecha_parto DATE;'
            );
        } else {
            mostrarError('Error al registrar parto', error.message);
        }
    }
}

async function cancelarPrenada(prenadaId, nombreVaca) {
    mostrarAdvertencia(
        'Cancelar Prenada',
        `¿Estás seguro de cancelar la prenada de "${nombreVaca}"?`,
        'Esta acción marcará la prenada como cancelada. Solo debe usarse en casos de aborto o problemas de gestación.',
        async () => {
            try {
                mostrarLoading('Cancelando prenada...');
                
                const { error } = await supabaseClient
                    .from('prenadas')
                    .update({
                        estado: 'Cancelada',
                        observaciones: 'Prenada cancelada por el usuario',
                        created_at: new Date().toISOString()
                    })
                    .eq('id', prenadaId);
                
                if (error) throw error;
                
                ocultarLoading();
                mostrarConfirmacion(`Prenada de "${nombreVaca}" cancelada correctamente`);
                
                // Actualizar lista
                await cargarPrenadas();
                
            } catch (error) {
                ocultarLoading();
                console.error('Error cancelando prenada:', error);
                mostrarError('Error al cancelar prenada', error.message);
            }
        }
    );
}

async function verDetallesPrenada(prenadaId) {
    try {
        mostrarLoading('Cargando detalles de la prenada...');
        
        const { data: prenada, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza, edad_aproximada, total_partos),
                toros (id, nombre, raza)
            `)
            .eq('id', prenadaId)
            .single();
        
        if (error) throw error;
        
        const hoy = new Date();
        const fechaPrenada = new Date(prenada.fecha_prenada);
        const fechaPartoEstimada = prenada.fecha_parto_estimada ? new Date(prenada.fecha_parto_estimada) : null;
        
        // Calcular días
        const diasDesdePrenada = Math.floor((hoy - fechaPrenada) / (1000 * 60 * 60 * 24));
        let diasHastaParto = null;
        let estado = prenada.estado;
        
        if (fechaPartoEstimada) {
            diasHastaParto = Math.ceil((fechaPartoEstimada - hoy) / (1000 * 60 * 60 * 24));
            
            if (prenada.estado === 'Prenada') {
                if (diasHastaParto < 0) {
                    estado = 'Retrasada';
                } else if (diasHastaParto <= 7) {
                    estado = 'Parto muy próximo';
                } else if (diasHastaParto <= 14) {
                    estado = 'Parto próximo';
                }
            }
        }
        
        // Crear HTML de detalles
        const detallesHTML = `
            <div class="prenada-details">
                <div class="detail-section">
                    <h5><i class="fas fa-info-circle"></i> Información General</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Estado:</span>
                            <span class="detail-value ${estado === 'Finalizada' ? 'estado-normal' : estado === 'Cancelada' ? 'estado-retrasado' : 'estado-cercano'}">
                                ${estado}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Fecha de Monta:</span>
                            <span class="detail-value">${formatearFecha(prenada.fecha_prenada)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Días de Gestación:</span>
                            <span class="detail-value">${diasDesdePrenada} días</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h5><i class="fas fa-cow"></i> Información de la Vaca</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">ID:</span>
                            <span class="detail-value">#${prenada.vacas?.id || prenada.vaca_id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Nombre:</span>
                            <span class="detail-value">${prenada.vacas?.nombre || 'Sin nombre'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Raza:</span>
                            <span class="detail-value">${prenada.vacas?.raza || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Partos previos:</span>
                            <span class="detail-value">${prenada.vacas?.total_partos || 0}</span>
                        </div>
                    </div>
                </div>
                
                ${prenada.toros ? `
                <div class="detail-section">
                    <h5><i class="fas fa-horse-head"></i> Información del Toro</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">ID:</span>
                            <span class="detail-value">#${prenada.toros.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Nombre:</span>
                            <span class="detail-value">${prenada.toros.nombre || 'Sin nombre'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Raza:</span>
                            <span class="detail-value">${prenada.toros.raza || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                ${fechaPartoEstimada ? `
                <div class="detail-section">
                    <h5><i class="fas fa-calendar-check"></i> Información del Parto</h5>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Parto Estimado:</span>
                            <span class="detail-value">${formatearFecha(prenada.fecha_parto_estimada)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Días restantes:</span>
                            <span class="detail-value ${diasHastaParto < 0 ? 'estado-retrasado' : diasHastaParto <= 7 ? 'estado-cercano' : ''}">
                                ${diasHastaParto < 0 ? `Retraso: ${Math.abs(diasHastaParto)} días` : `${diasHastaParto} días`}
                            </span>
                        </div>
                        ${prenada.fecha_parto ? `
                        <div class="detail-item">
                            <span class="detail-label">Parto Real:</span>
                            <span class="detail-value">${formatearFecha(prenada.fecha_parto)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Terneros vivos:</span>
                            <span class="detail-value">${prenada.terneros_vivos || 0}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Terneros muertos:</span>
                            <span class="detail-value">${prenada.terneros_muertos || 0}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${prenada.observaciones ? `
                <div class="detail-section">
                    <h5><i class="fas fa-sticky-note"></i> Observaciones</h5>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        ${prenada.observaciones}
                    </p>
                </div>
                ` : ''}
                
                ${prenada.observaciones_partos ? `
                <div class="detail-section">
                    <h5><i class="fas fa-baby"></i> Observaciones del Parto</h5>
                    <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        ${prenada.observaciones_partos}
                    </p>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('prenada-detail-body').innerHTML = detallesHTML;
        document.getElementById('prenada-detail-modal').classList.remove('hidden');
        
        ocultarLoading();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando detalles de prenada:', error);
        mostrarError('Error', 'No se pudieron cargar los detalles de la prenada', error.message);
    }
}

async function cargarHistorialPrenadas() {
    try {
        mostrarLoading('Cargando historial de prenadas...');
        
        const { data: prenadas, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza),
                toros (id, nombre)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        // Aquí podrías implementar la visualización del historial
        // Por ejemplo, en una nueva pestaña o modal
        
        ocultarLoading();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando historial:', error);
    }
}

async function generarReportePrenadas() {
    try {
        mostrarLoading('Generando reporte...');
        
        const { data: prenadas, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza),
                toros (id, nombre, raza)
            `)
            .order('fecha_prenada', { ascending: false });
        
        if (error) throw error;
        
        // Crear CSV
        const headers = [
            'ID Prenada', 'ID Vaca', 'Nombre Vaca', 'Raza Vaca', 
            'ID Toro', 'Nombre Toro', 'Fecha Monta', 'Parto Estimado', 
            'Parto Real', 'Estado', 'Terneros Vivos', 'Terneros Muertos',
            'Observaciones', 'Fecha Registro'
        ];
        
        const csvData = prenadas.map(p => [
            p.id,
            p.vaca_id,
            p.vacas?.nombre || '',
            p.vacas?.raza || '',
            p.toro_padre || '',
            p.toros?.nombre || '',
            p.fecha_prenada,
            p.fecha_parto_estimada || '',
            p.fecha_parto || '',
            p.estado,
            p.terneros_vivos || 0,
            p.terneros_muertos || 0,
            p.observaciones ? `"${p.observaciones.replace(/"/g, '""')}"` : '',
            p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
        ]);
        
        const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_prenadas_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        ocultarLoading();
        mostrarConfirmacion('Reporte de prenadas generado exitosamente');
        
    } catch (error) {
        ocultarLoading();
        console.error('Error generando reporte:', error);
        mostrarError('Error', 'No se pudo generar el reporte', error.message);
    }
}

// ================= FUNCIONES PARA REGISTRO MANUAL DE TERNEROS =================
function actualizarFormulariosTerneros() {
    const totalTerneros = parseInt(document.getElementById('parto-total').value) || 1;
    const container = document.getElementById('terneros-container');
    
    // Mantener el título
    const titulo = container.querySelector('h4');
    const descripcion = container.querySelector('p');
    
    // Limpiar formularios existentes (excepto título)
    const formulariosExistentes = container.querySelectorAll('.ternero-form');
    formulariosExistentes.forEach(form => form.remove());
    
    // Crear nuevos formularios
    for (let i = 1; i <= totalTerneros; i++) {
        const terneroForm = document.createElement('div');
        terneroForm.className = 'ternero-form';
        terneroForm.id = `ternero-${i}`;
        
        terneroForm.innerHTML = `
            <div class="ternero-header">
                <h5><i class="fas fa-horse"></i> Ternero ${i}</h5>
                <span class="ternero-badge">#${i}</span>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="te_id_${i}"><i class="fas fa-tag"></i> Número de Arete (ID)</label>
                    <input type="number" id="te_id_${i}" placeholder="Ej: ${4000 + i}" required oninput="validarIdTernero(${i})">
                    <small class="form-hint">Identificador único del ternero</small>
                    <div id="id-status-${i}" class="id-validation-status"></div>
                </div>
                <div class="form-group">
                    <label for="te_nombre_${i}"><i class="fas fa-signature"></i> Nombre</label>
                    <input type="text" id="te_nombre_${i}" placeholder="Ej: Manchitas, Torito">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="te_genero_${i}"><i class="fas fa-venus-mars"></i> Género</label>
                    <select id="te_genero_${i}">
                        <option value="Macho">Macho</option>
                        <option value="Hembra">Hembra</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="te_raza_${i}"><i class="fas fa-dna"></i> Raza</label>
                    <input type="text" id="te_raza_${i}" placeholder="Ej: Holstein, Angus, etc.">
                </div>
            </div>
        `;
        
        container.appendChild(terneroForm);
    }
}

async function validarIdTernero(numero) {
    const idInput = document.getElementById(`te_id_${numero}`);
    const idValue = idInput.value.trim();
    const statusDiv = document.getElementById(`id-status-${numero}`);
    
    // Limpiar estado anterior
    idInput.classList.remove('ternero-id-valid', 'ternero-id-invalid', 'ternero-id-checking');
    statusDiv.className = 'id-validation-status';
    statusDiv.textContent = '';
    
    if (!idValue) return;
    
    if (isNaN(idValue) || parseInt(idValue) <= 0) {
        idInput.classList.add('ternero-id-invalid');
        statusDiv.className = 'id-validation-status taken show';
        statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> ID debe ser número positivo';
        return;
    }
    
    // Mostrar estado de verificación
    idInput.classList.add('ternero-id-checking');
    statusDiv.className = 'id-validation-status checking show';
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    
    try {
        const resultado = await validarIdUnico(idValue, 'Ternero');
        
        if (resultado.disponible) {
            idInput.classList.remove('ternero-id-checking');
            idInput.classList.add('ternero-id-valid');
            statusDiv.className = 'id-validation-status available show';
            statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${resultado.mensaje}`;
        } else {
            idInput.classList.remove('ternero-id-checking');
            idInput.classList.add('ternero-id-invalid');
            statusDiv.className = 'id-validation-status taken show';
            statusDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${resultado.mensaje}`;
        }
    } catch (error) {
        idInput.classList.remove('ternero-id-checking');
        statusDiv.className = 'id-validation-status';
        console.error('Error validando ID:', error);
    }
}

function obtenerDatosTerneros() {
    const totalTerneros = parseInt(document.getElementById('parto-total').value) || 1;
    const terneros = [];
    
    for (let i = 1; i <= totalTerneros; i++) {
        const id = document.getElementById(`te_id_${i}`).value;
        const nombre = document.getElementById(`te_nombre_${i}`).value;
        const genero = document.getElementById(`te_genero_${i}`).value;
        const raza = document.getElementById(`te_raza_${i}`).value;
        
        if (id) { // Solo agregar si tiene ID
            terneros.push({
                id: parseInt(id),
                nombre: nombre || `Ternero ${i}`,
                genero: genero,
                raza: raza || 'Desconocida'
            });
        }
    }
    
    return terneros;
}

// ================= SISTEMA DE REINTENTOS INTELIGENTES =================
async function ejecutarConReintentos(operacion, maxReintentos = 3, delayInicial = 1000) {
    let ultimoError;
    
    for (let intento = 1; intento <= maxReintentos; intento++) {
        try {
            return await operacion();
        } catch (error) {
            ultimoError = error;
            
            // No reintentar para errores de validación del cliente
            if (error.message.includes('validación') || 
                error.message.includes('ID') || 
                error.message.includes('formato')) {
                throw error;
            }
            
            // Calcular delay exponencial con jitter
            const delay = delayInicial * Math.pow(2, intento - 1);
            const jitter = delay * 0.1 * Math.random();
            const delayTotal = delay + jitter;
            
            if (intento < maxReintentos) {
                console.warn(`Reintento ${intento}/${maxReintentos} después de ${delayTotal}ms:`, error.message);
                mostrarToast('warning', 'Reintentando...', 
                    `Operación falló. Reintento ${intento} de ${maxReintentos}`);
                
                await new Promise(resolve => setTimeout(resolve, delayTotal));
            }
        }
    }
    
    throw ultimoError;
}

// ================= VALIDACIONES DE INTEGRIDAD =================
async function verificarIntegridadDatos() {
    const problemas = [];
    
    try {
        // Verificar que todos los animales tengan su registro específico
        const { data: animales, error } = await supabaseClient
            .from('animales')
            .select('id, tipo');
        
        if (error) throw error;
        
        for (const animal of animales) {
            let registroEspecifico = null;
            
            switch (animal.tipo) {
                case 'Vaca':
                    const { data: vaca } = await supabaseClient
                        .from('vacas')
                        .select('id')
                        .eq('id', animal.id)
                        .single();
                    registroEspecifico = vaca;
                    break;
                    
                case 'Toro':
                    const { data: toro } = await supabaseClient
                        .from('toros')
                        .select('id')
                        .eq('id', animal.id)
                        .single();
                    registroEspecifico = toro;
                    break;
                    
                case 'Ternero':
                    const { data: ternero } = await supabaseClient
                        .from('terneros')
                        .select('id')
                        .eq('id', animal.id)
                        .single();
                    registroEspecifico = ternero;
                    break;
            }
            
            if (!registroEspecifico) {
                problemas.push(`Animal ${animal.id} (${animal.tipo}) no tiene registro específico`);
            }
        }
        
        // Verificar relaciones de padres/madres
        const { data: terneros } = await supabaseClient
            .from('terneros')
            .select('id, padre, madre');
        
        for (const ternero of terneros || []) {
            if (ternero.padre) {
                const { data: padre } = await supabaseClient
                    .from('animales')
                    .select('tipo')
                    .eq('id', ternero.padre)
                    .single();
                
                if (!padre || padre.tipo !== 'Toro') {
                    problemas.push(`Ternero ${ternero.id}: padre ${ternero.padre} no existe o no es toro`);
                }
            }
            
            if (ternero.madre) {
                const { data: madre } = await supabaseClient
                    .from('animales')
                    .select('tipo')
                    .eq('id', ternero.madre)
                    .single();
                
                if (!madre || madre.tipo !== 'Vaca') {
                    problemas.push(`Ternero ${ternero.id}: madre ${ternero.madre} no existe o no es vaca`);
                }
            }
        }
        
    } catch (error) {
        console.error('Error verificando integridad:', error);
        problemas.push(`Error verificando integridad: ${error.message}`);
    }
    
    return problemas;
}

function iniciarVerificacionesPeriodicas() {
    // Verificar cada 5 minutos
    setInterval(async () => {
        const problemas = await verificarIntegridadDatos();
        if (problemas.length > 0) {
            console.warn('Problemas de integridad encontrados:', problemas);
            
            // Solo mostrar advertencia si hay problemas graves
            if (problemas.some(p => p.includes('no existe'))) {
                mostrarToast('warning', 'Problemas de integridad', 
                    `Se encontraron ${problemas.length} problemas en los datos`);
            }
        }
    }, 5 * 60 * 1000); // 5 minutos
}

// ================= SISTEMA DE HISTORIAL DE PARTOS =================
async function cargarHistorialPartos() {
    console.log("Cargando historial de partos...");
    mostrarLoading('Cargando historial de partos...');
    
    try {
        // Obtener todas las prenadas finalizadas o canceladas
        const { data: prenadas, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza, edad_aproximada, total_partos),
                toros (id, nombre, raza)
            `)
            .in('estado', ['Finalizada', 'Cancelada'])
            .order('fecha_parto', { ascending: false });
        
        if (error) throw error;
        
        console.log(`Se encontraron ${prenadas?.length || 0} partos en el historial`);
        
        // Procesar datos para el historial
        historialPartos = prenadas.map(prenada => {
            // Calcular duración de gestación en días
            let duracionGestacion = null;
            if (prenada.fecha_prenada && prenada.fecha_parto) {
                const fechaInicio = new Date(prenada.fecha_prenada);
                const fechaFin = new Date(prenada.fecha_parto);
                duracionGestacion = Math.round((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
            }
            
            // Formatear fechas
            const fechaPartoFormateada = prenada.fecha_parto 
                ? formatearFecha(prenada.fecha_parto)
                : 'No registrada';
            
            const fechaPrenadaFormateada = prenada.fecha_prenada 
                ? formatearFecha(prenada.fecha_prenada)
                : 'No registrada';
            
            return {
                ...prenada,
                fecha_partoo_formateada: fechaPartoFormateada,
                fecha_prenada_formateada: fechaPrenadaFormateada,
                duracion_gestacion: duracionGestacion,
                total_terneros: (prenada.terneros_vivos || 0) + (prenada.terneros_muertos || 0)
            };
        });
        
        historialFiltrado = [...historialPartos];
        
        // Actualizar estadísticas
        actualizarEstadisticasHistorial();
        
        // Renderizar tabla
        renderizarTablaHistorial();
        
        // Generar gráficos
        generarGraficosHistorial();
        
    } catch (error) {
        console.error("Error cargando historial de partos:", error);
        document.getElementById('historial-table-body').innerHTML = `
            <tr><td colspan="7" class="no-data error">
                <i class="fas fa-exclamation-triangle"></i> Error cargando historial: ${error.message}
            </td></tr>
        `;
        historialPartos = [];
        historialFiltrado = [];
    } finally {
        ocultarLoading();
    }
}

function actualizarEstadisticasHistorial() {
    if (historialPartos.length === 0) {
        document.getElementById('historial-total').textContent = '0';
        document.getElementById('historial-exitosos').textContent = '0';
        document.getElementById('historial-terneros').textContent = '0';
        document.getElementById('historial-promedio').textContent = '0.0';
        return;
    }
    
    const totalPartos = historialPartos.length;
    const partosExitosos = historialPartos.filter(p => p.estado === 'Finalizada').length;
    const totalTernerosVivos = historialPartos.reduce((sum, p) => sum + (p.terneros_vivos || 0), 0);
    const totalTernerosMuertos = historialPartos.reduce((sum, p) => sum + (p.terneros_muertos || 0), 0);
    const totalTerneros = totalTernerosVivos + totalTernerosMuertos;
    const promedioTerneros = totalPartos > 0 ? (totalTernerosVivos / partosExitosos).toFixed(1) : '0.0';
    
    document.getElementById('historial-total').textContent = totalPartos;
    document.getElementById('historial-exitosos').textContent = partosExitosos;
    document.getElementById('historial-terneros').textContent = totalTernerosVivos;
    document.getElementById('historial-promedio').textContent = promedioTerneros;
    
    // Actualizar contador
    document.getElementById('historial-count').textContent = `${totalPartos} partos registrados`;
}

function renderizarTablaHistorial() {
    const tbody = document.getElementById('historial-table-body');
    
    if (!tbody) {
        console.error("No se encontró historial-table-body");
        return;
    }
    
    if (historialFiltrado.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="no-data">
                <i class="fas fa-search"></i> No se encontraron partos en el historial
            </td></tr>
        `;
        actualizarPaginacionHistorial();
        return;
    }
    
    const inicio = (paginaHistorialActual - 1) * itemsPorPaginaHistorial;
    const fin = inicio + itemsPorPaginaHistorial;
    const partosPagina = historialFiltrado.slice(inicio, fin);
    
    const filasHTML = partosPagina.map(parto => {
        const vacaInfo = parto.vacas || {};
        const toroInfo = parto.toros || {};
        
        // Determinar clase de duración
        let claseDuracion = '';
        if (parto.duracion_gestacion) {
            if (parto.duracion_gestacion < 270) claseDuracion = 'duracion-corta';
            else if (parto.duracion_gestacion > 300) claseDuracion = 'duracion-larga';
            else claseDuracion = 'duracion-normal';
        }
        
        // Badge de estado
        let badgeEstado = '';
        let claseEstado = '';
        if (parto.estado === 'Finalizada') {
            badgeEstado = '<span class="badge-estado badge-exitoso">Exitoso</span>';
            claseEstado = 'estado-exitoso';
        } else if (parto.estado === 'Cancelada') {
            badgeEstado = '<span class="badge-estado badge-cancelado">Cancelado</span>';
            claseEstado = 'estado-cancelado';
        }
        
        return `
            <tr class="${claseEstado}">
                <td>
                    <strong>${parto.fecha_partoo_formateada}</strong>
                    ${parto.duracion_gestacion ? 
                        `<br><small class="duracion-gestacion ${claseDuracion}">${parto.duracion_gestacion} días</small>` : 
                        ''}
                </td>
                <td>
                    <strong>#${vacaInfo.id || parto.vaca_id}</strong><br>
                    ${vacaInfo.nombre || 'Sin nombre'}<br>
                    <small>${vacaInfo.raza || ''}</small>
                </td>
                <td>
                    ${toroInfo.id ? 
                        `<strong>#${toroInfo.id}</strong><br>
                         ${toroInfo.nombre || 'Sin nombre'}<br>
                         <small>${toroInfo.raza || ''}</small>` : 
                        'No registrado'}
                </td>
                <td>
                    <div class="terneros-info">
                        ${parto.terneros_vivos > 0 ? 
                            `<span class="terneros-vivos">✓ ${parto.terneros_vivos} vivo(s)</span>` : ''}
                        ${parto.terneros_muertos > 0 ? 
                            `<span class="terneros-muertos">✗ ${parto.terneros_muertos} muerto(s)</span>` : ''}
                        ${parto.total_terneros === 0 ? 'Sin terneros' : ''}
                    </div>
                </td>
                <td>${badgeEstado}</td>
                <td>
                    ${parto.duracion_gestacion ? 
                        `${parto.duracion_gestacion} días` : 
                        'N/A'}
                </td>
                <td>
                    <div class="animal-actions">
                        <button class="btn-action btn-view" onclick="verDetalleParto(${parto.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i> Detalles
                        </button>
                        ${parto.estado === 'Finalizada' && parto.terneros_vivos > 0 ? 
                            `<button class="btn-action btn-edit" onclick="verTernerosParto(${parto.id})" 
                                    title="Ver terneros">
                                <i class="fas fa-horse"></i> Terneros
                            </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = filasHTML;
    actualizarPaginacionHistorial();
}

function filtrarHistorial() {
    const busqueda = document.getElementById('historial-search').value.toLowerCase();
    const añoFiltro = document.getElementById('historial-fecha').value;
    const estadoFiltro = document.getElementById('historial-estado').value;
    const orden = document.getElementById('historial-orden').value;
    
    let resultados = historialPartos.filter(parto => {
        // Búsqueda por ID de vaca, nombre o raza
        const vacaInfo = parto.vacas || {};
        const coincideBusqueda = 
            (vacaInfo.id && vacaInfo.id.toString().includes(busqueda)) ||
            (vacaInfo.nombre && vacaInfo.nombre.toLowerCase().includes(busqueda)) ||
            (vacaInfo.raza && vacaInfo.raza.toLowerCase().includes(busqueda)) ||
            (parto.vaca_id && parto.vaca_id.toString().includes(busqueda));
        
        // Filtro por año
        let coincideAño = true;
        if (añoFiltro !== 'all' && parto.fecha_parto) {
            const añoParto = new Date(parto.fecha_parto).getFullYear();
            coincideAño = añoParto.toString() === añoFiltro;
        }
        
        // Filtro por estado
        const coincideEstado = estadoFiltro === 'all' || parto.estado === estadoFiltro;
        
        return coincideBusqueda && coincideAño && coincideEstado;
    });
    
    // Ordenar resultados
    resultados.sort((a, b) => {
        switch (orden) {
            case 'fecha_desc':
                return new Date(b.fecha_parto || 0) - new Date(a.fecha_parto || 0);
            case 'fecha_asc':
                return new Date(a.fecha_parto || 0) - new Date(b.fecha_parto || 0);
            case 'terneros_desc':
                return (b.terneros_vivos || 0) - (a.terneros_vivos || 0);
            case 'vaca_asc':
                const nombreA = a.vacas?.nombre || '';
                const nombreB = b.vacas?.nombre || '';
                return nombreA.localeCompare(nombreB);
            default:
                return 0;
        }
    });
    
    historialFiltrado = resultados;
    paginaHistorialActual = 1;
    renderizarTablaHistorial();
}

function resetFiltrosHistorial() {
    document.getElementById('historial-search').value = '';
    document.getElementById('historial-fecha').value = 'all';
    document.getElementById('historial-estado').value = 'all';
    document.getElementById('historial-orden').value = 'fecha_desc';
    
    historialFiltrado = [...historialPartos];
    paginaHistorialActual = 1;
    renderizarTablaHistorial();
}

function actualizarPaginacionHistorial() {
    const totalPaginas = Math.ceil(historialFiltrado.length / itemsPorPaginaHistorial);
    const prevButton = document.getElementById('prev-page-historial');
    const nextButton = document.getElementById('next-page-historial');
    const pageInfo = document.getElementById('page-info-historial');
    
    if (prevButton && nextButton && pageInfo) {
        prevButton.disabled = paginaHistorialActual === 1;
        nextButton.disabled = paginaHistorialActual === totalPaginas || totalPaginas === 0;
        pageInfo.textContent = `Página ${paginaHistorialActual} de ${totalPaginas}`;
    }
}

function cambiarPaginaHistorial(direccion) {
    const totalPaginas = Math.ceil(historialFiltrado.length / itemsPorPaginaHistorial);
    const nuevaPagina = paginaHistorialActual + direccion;
    
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaHistorialActual = nuevaPagina;
        renderizarTablaHistorial();
    }
}

async function verDetalleParto(partoId) {
    try {
        mostrarLoading('Cargando detalles del parto...');
        
        const { data: parto, error } = await supabaseClient
            .from('prenadas')
            .select(`
                *,
                vacas (id, nombre, raza, edad_aproximada, total_partos, observaciones),
                toros (id, nombre, raza, edad_aproximada)
            `)
            .eq('id', partoId)
            .single();
        
        if (error) throw error;
        
        // Calcular duración de gestación
        let duracionGestacion = null;
        let estadoDuracion = 'normal';
        if (parto.fecha_prenada && parto.fecha_parto) {
            const fechaInicio = new Date(parto.fecha_prenada);
            const fechaFin = new Date(parto.fecha_parto);
            duracionGestacion = Math.round((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
            
            if (duracionGestacion < 270) estadoDuracion = 'corta';
            else if (duracionGestacion > 300) estadoDuracion = 'larga';
        }
        
        // Obtener terneros de este parto
        let terneros = [];
        if (parto.estado === 'Finalizada' && parto.vaca_id) {
            const { data: ternerosData } = await supabaseClient
                .from('terneros')
                .select('*')
                .eq('madre', parto.vaca_id)
                .eq('fecha_nacimiento', parto.fecha_parto);
            
            terneros = ternerosData || [];
        }
        
        // Crear HTML del detalle
        const detallesHTML = `
            <div class="parto-detalles">
                <div class="detalle-seccion">
                    <h4><i class="fas fa-info-circle"></i> Información del Parto</h4>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <span class="detalle-label">Estado:</span>
                            <span class="detalle-value">
                                ${parto.estado === 'Finalizada' ? 
                                    '<span class="badge-estado badge-exitoso">Exitoso</span>' : 
                                    '<span class="badge-estado badge-cancelado">Cancelado</span>'}
                            </span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Fecha de Monta:</span>
                            <span class="detalle-value">${formatearFecha(parto.fecha_prenada)}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Fecha de Parto:</span>
                            <span class="detalle-value">${formatearFecha(parto.fecha_parto)}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Duración Gestación:</span>
                            <span class="detalle-value ${estadoDuracion}">
                                ${duracionGestacion ? `${duracionGestacion} días` : 'N/A'}
                            </span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Terneros Vivos:</span>
                            <span class="detalle-value">${parto.terneros_vivos || 0}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Terneros Muertos:</span>
                            <span class="detalle-value">${parto.terneros_muertos || 0}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Total Terneros:</span>
                            <span class="detalle-value">${(parto.terneros_vivos || 0) + (parto.terneros_muertos || 0)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detalle-seccion">
                    <h4><i class="fas fa-cow"></i> Información de la Vaca</h4>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <span class="detalle-label">ID:</span>
                            <span class="detalle-value">#${parto.vacas?.id || parto.vaca_id}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Nombre:</span>
                            <span class="detalle-value">${parto.vacas?.nombre || 'Sin nombre'}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Raza:</span>
                            <span class="detalle-value">${parto.vacas?.raza || 'N/A'}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Edad:</span>
                            <span class="detalle-value">${parto.vacas?.edad_aproximada || 'N/A'} años</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Partos Totales:</span>
                            <span class="detalle-value">${parto.vacas?.total_partos || 0}</span>
                        </div>
                    </div>
                </div>
                
                ${parto.toros ? `
                <div class="detalle-seccion">
                    <h4><i class="fas fa-horse-head"></i> Información del Toro</h4>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <span class="detalle-label">ID:</span>
                            <span class="detalle-value">#${parto.toros.id}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Nombre:</span>
                            <span class="detalle-value">${parto.toros.nombre || 'Sin nombre'}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Raza:</span>
                            <span class="detalle-value">${parto.toros.raza || 'N/A'}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Edad:</span>
                            <span class="detalle-value">${parto.toros.edad_aproximada || 'N/A'} años</span>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                ${parto.observaciones || parto.observaciones_parto ? `
                <div class="detalle-seccion">
                    <h4><i class="fas fa-sticky-note"></i> Observaciones</h4>
                    <div style="padding: 10px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
                        ${parto.observaciones ? `<p><strong>Durante gestación:</strong><br>${parto.observaciones}</p>` : ''}
                        ${parto.observaciones_parto ? `<p><strong>Durante parto:</strong><br>${parto.observaciones_parto}</p>` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${terneros.length > 0 ? `
                <div class="detalle-seccion">
                    <h4><i class="fas fa-horse"></i> Terneros Registrados</h4>
                    <div class="lista-terneros">
                        ${terneros.map(ternero => `
                            <div class="ternero-item">
                                <div class="ternero-info">
                                    <span class="ternero-nombre">${ternero.nombre || 'Sin nombre'}</span>
                                    <div class="ternero-datos">
                                        <span>ID: #${ternero.id}</span>
                                        <span>Género: ${ternero.genero}</span>
                                        <span>Raza: ${ternero.raza || 'N/A'}</span>
                                    </div>
                                </div>
                                <button class="btn-action btn-view small" onclick="verDetalles(${ternero.id})">
                                    <i class="fas fa-eye"></i> Ver
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Crear modal dinámico para el detalle
        const modalHTML = `
            <div class="modal" id="detalle-parto-modal">
                <div class="modal-content parto-detalle-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-baby"></i> Detalles del Parto</h3>
                        <button class="btn-close" onclick="document.getElementById('detalle-parto-modal').classList.add('hidden')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${detallesHTML}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="document.getElementById('detalle-parto-modal').classList.add('hidden')">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar modal al DOM si no existe
        let modalExistente = document.getElementById('detalle-parto-modal');
        if (modalExistente) {
            modalExistente.remove();
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('detalle-parto-modal').classList.remove('hidden');
        
        ocultarLoading();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando detalle de parto:', error);
        mostrarError('Error', 'No se pudieron cargar los detalles del parto', error.message);
    }
}

async function verTernerosParto(partoId) {
    try {
        mostrarLoading('Buscando terneros...');
        
        // Obtener información del parto primero
        const { data: parto, error: errorParto } = await supabaseClient
            .from('prenadas')
            .select('vaca_id, fecha_parto')
            .eq('id', partoId)
            .single();
        
        if (errorParto) throw errorParto;
        
        // Buscar terneros con esa madre y fecha de nacimiento
        const { data: terneros, error: errorTerneros } = await supabaseClient
            .from('terneros')
            .select('*')
            .eq('madre', parto.vaca_id)
            .eq('fecha_nacimiento', parto.fecha_parto);
        
        if (errorTerneros) throw errorTerneros;
        
        if (terneros.length === 0) {
            ocultarLoading();
            mostrarAdvertencia('Sin Terneros', 'No se encontraron terneros registrados para este parto');
            return;
        }
        
        // Redirigir a la pestaña de consulta con filtro
        cambiarTab('consulta');
        
        // Filtrar solo los terneros de este parto
        setTimeout(() => {
            document.getElementById('search-input').value = terneros.map(t => t.id).join(',');
            document.getElementById('filter-type').value = 'Ternero';
            filtrarAnimales();
            
            ocultarLoading();
            mostrarConfirmacion(`Se encontraron ${terneros.length} ternero(s) de este parto`);
        }, 500);
        
    } catch (error) {
        ocultarLoading();
        console.error('Error buscando terneros:', error);
        mostrarError('Error', 'No se pudieron cargar los terneros del parto', error.message);
    }
}

function generarGraficosHistorial() {
    // Destruir gráficos existentes si hay
    if (charts.historialMensual) charts.historialMensual.destroy();
    if (charts.resultadosPartos) charts.resultadosPartos.destroy();
    
    // Gráfico de partos por mes
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partosMensuales = new Array(12).fill(0);
    const ternerosMensuales = new Array(12).fill(0);
    
    historialPartos.forEach(parto => {
        if (parto.fecha_parto) {
            const fecha = new Date(parto.fecha_parto);
            const mes = fecha.getMonth();
            partosMensuales[mes]++;
            ternerosMensuales[mes] += (parto.terneros_vivos || 0);
        }
    });
    
    const ctxMensual = document.getElementById('chart-partos-mensuales')?.getContext('2d');
    if (ctxMensual) {
        charts.historialMensual = new Chart(ctxMensual, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Partos',
                        data: partosMensuales,
                        backgroundColor: 'rgba(33, 150, 243, 0.7)',
                        borderColor: '#2196f3',
                        borderWidth: 1
                    },
                    {
                        label: 'Terneros Nacidos',
                        data: ternerosMensuales,
                        backgroundColor: 'rgba(76, 175, 80, 0.7)',
                        borderColor: '#4caf50',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
    
    // Gráfico de distribución por resultado
    const partosExitosos = historialPartos.filter(p => p.estado === 'Finalizada').length;
    const partosCancelados = historialPartos.filter(p => p.estado === 'Cancelada').length;
    
    const ctxResultados = document.getElementById('chart-resultados-partos')?.getContext('2d');
    if (ctxResultados) {
        charts.resultadosPartos = new Chart(ctxResultados, {
            type: 'pie',
            data: {
                labels: ['Exitosos', 'Cancelados'],
                datasets: [{
                    data: [partosExitosos, partosCancelados],
                    backgroundColor: ['#4caf50', '#f44336'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

async function generarReporteHistorial() {
    if (historialPartos.length === 0) {
        mostrarAdvertencia('Sin Datos', 'No hay partos registrados en el historial para exportar.');
        return;
    }
    
    try {
        mostrarLoading('Generando reporte del historial...');
        
        // Preparar datos para el CSV
        const headers = [
            'ID Parto', 'Fecha Parto', 'Vaca ID', 'Nombre Vaca', 'Raza Vaca',
            'Toro ID', 'Nombre Toro', 'Raza Toro', 'Fecha Monta', 
            'Duración Gestación (días)', 'Terneros Vivos', 'Terneros Muertos',
            'Total Terneros', 'Estado', 'Observaciones', 'Observaciones Parto'
        ];
        
        const csvData = historialPartos.map(parto => {
            const vaca = parto.vacas || {};
            const toro = parto.toros || {};
            
            return [
                parto.id,
                formatearFecha(parto.fecha_parto),
                parto.vaca_id,
                vaca.nombre || '',
                vaca.raza || '',
                toro.id || '',
                toro.nombre || '',
                toro.raza || '',
                formatearFecha(parto.fecha_prenada),
                parto.duracion_gestacion || '',
                parto.terneros_vivos || 0,
                parto.terneros_muertos || 0,
                (parto.terneros_vivos || 0) + (parto.terneros_muertos || 0),
                parto.estado,
                parto.observaciones ? `"${parto.observaciones.replace(/"/g, '""')}"` : '',
                parto.observaciones_parto ? `"${parto.observaciones_parto.replace(/"/g, '""')}"` : ''
            ];
        });
        
        const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fechaActual = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_partos_${fechaActual}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        ocultarLoading();
        mostrarConfirmacion('Reporte del historial generado exitosamente');
        
    } catch (error) {
        ocultarLoading();
        console.error('Error generando reporte:', error);
        mostrarError('Error', 'No se pudo generar el reporte del historial', error.message);
    }
}

function actualizarFiltroAnios() {
    const selectAnio = document.getElementById('historial-fecha');
    
    // Obtener años únicos de los partos
    const aniosUnicos = new Set();
    historialPartos.forEach(parto => {
        if (parto.fecha_parto) {
            const anio = new Date(parto.fecha_parto).getFullYear();
            aniosUnicos.add(anio);
        }
    });
    
    // Ordenar años descendente
    const aniosOrdenados = Array.from(aniosUnicos).sort((a, b) => b - a);
    
    // Limpiar opciones excepto "Todos los años"
    const opcionesActuales = selectAnio.querySelectorAll('option');
    opcionesActuales.forEach((opcion, index) => {
        if (index > 0) opcion.remove();
    });
    
    // Agregar años encontrados
    aniosOrdenados.forEach(anio => {
        const option = document.createElement('option');
        option.value = anio;
        option.textContent = anio;
        selectAnio.appendChild(option);
    });
}

// ================= MANEJO DE ERRORES GLOBAL =================
window.addEventListener('error', function(event) {
    console.error('Error global capturado:', event.error);
    
    // Prevenir múltiples mensajes de error
    if (document.getElementById('error-message').classList.contains('hidden')) {
        mostrarError(
            'Error en la Aplicación',
            'Ha ocurrido un error inesperado',
            `Error: ${event.error?.message || 'Desconocido'}\n\nPor favor, recarga la página e intenta nuevamente.`
        );
    }
    
    // Prevenir que el error se propague
    event.preventDefault();
});

// Capturar errores no manejados en promesas
window.addEventListener('unhandledrejection', function(event) {
    console.error('Promesa rechazada no manejada:', event.reason);
    
    mostrarError(
        'Error en Operación',
        'La operación no pudo completarse',
        `Error: ${event.reason?.message || 'Error desconocido en operación asíncrona'}`
    );
    
    event.preventDefault();
});

// ================= SISTEMA DE TOASTS =================
function mostrarToast(tipo, titulo, mensaje, duracion = 5000) {
    const container = document.getElementById('toast-container') || crearContenedorToasts();
    
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    
    const icono = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[tipo] || 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icono}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${sanitizarTexto(titulo)}</div>
            <div class="toast-message">${sanitizarTexto(mensaje)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto-eliminar después de la duración
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, duracion);
    
    return toast;
}

function crearContenedorToasts() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function protegerContraClicsMultiples(elemento, tiempoMs = 2000) {
    if (elemento.disabled) return false;
    
    elemento.disabled = true;
    elemento.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    
    setTimeout(() => {
        elemento.disabled = false;
        // Restaurar texto original basado en el tipo de botón
        if (elemento.classList.contains('btn-primary')) {
            elemento.innerHTML = '<i class="fas fa-save"></i> Guardar';
        }
    }, tiempoMs);
    
    return true;
}

// ================= SISTEMA DE VACUNAS SIMPLIFICADO =================

// Variables globales para vacunas
let vacunasCargadas = [];
let vacunasFiltradas = [];
let paginaVacunasActual = 1;
const itemsPorPaginaVacunas = 10;
let vacunaEditando = null;

// Configurar la pestaña de vacunas
function configurarPestanaVacunas() {
    const tabVacunas = document.getElementById('tab-vacunas');
    if (tabVacunas) {
        tabVacunas.addEventListener('click', function() {
            setTimeout(() => {
                if (document.getElementById('tab-content-vacunas').classList.contains('active')) {
                    cargarVacunas();
                }
            }, 100);
        });
    }
}

// Mostrar formulario de vacuna
async function mostrarFormularioVacuna() {
    console.log("Mostrando formulario de vacuna...");
    const modal = document.getElementById('modal-vacuna');
    
    if (!modal) {
        mostrarError("Error", "No se encontró el modal de vacunas");
        return;
    }
    
    mostrarLoading("Cargando animales...");
    
    try {
        // Cargar animales desde Supabase
        const { data: animales, error } = await supabaseClient
            .from('animales')
            .select(`
                id,
                tipo,
                vacas (nombre, raza),
                toros (nombre, raza),
                terneros (nombre, raza)
            `)
            .order('id');
        
        if (error) throw error;
        
        // Limpiar y llenar el select de animales
        const selectAnimal = document.getElementById('vac_animal');
        if (!selectAnimal) {
            throw new Error("No se encontró el select de animales");
        }
        
        selectAnimal.innerHTML = '<option value="">Selecciona un animal...</option>';
        
        if (animales && animales.length > 0) {
            animales.forEach(animal => {
                let nombre = 'Sin nombre';
                let raza = 'Sin raza';
                
                // Obtener nombre y raza según el tipo
                switch (animal.tipo) {
                    case 'Vaca':
                        nombre = animal.vacas?.nombre || 'Sin nombre';
                        raza = animal.vacas?.raza || 'Sin raza';
                        break;
                    case 'Toro':
                        nombre = animal.toros?.nombre || 'Sin nombre';
                        raza = animal.toros?.raza || 'Sin raza';
                        break;
                    case 'Ternero':
                        nombre = animal.terneros?.nombre || 'Sin nombre';
                        raza = animal.terneros?.raza || 'Sin raza';
                        break;
                }
                
                const option = document.createElement('option');
                option.value = animal.id;
                option.textContent = `#${animal.id} - ${nombre} (${raza}) - ${animal.tipo}`;
                option.dataset.tipo = animal.tipo;
                option.dataset.nombre = nombre;
                option.dataset.raza = raza;
                selectAnimal.appendChild(option);
            });
        } else {
            selectAnimal.innerHTML = '<option value="">No hay animales registrados</option>';
        }
        
        // Configurar fecha actual por defecto
        const hoy = new Date().toISOString().split('T')[0];
        const fechaInput = document.getElementById('vac_fecha');
        if (fechaInput) {
            fechaInput.value = hoy;
            fechaInput.max = hoy; // No permitir fechas futuras
            fechaInput.min = '2000-01-01';
        }
        
        // Mostrar modal
        modal.classList.remove('hidden');
        ocultarLoading();
        
        console.log("Formulario de vacuna cargado exitosamente");
        
    } catch (error) {
        ocultarLoading();
        console.error("Error cargando formulario de vacuna:", error);
        mostrarError("Error al cargar el formulario", error.message);
    }
}

// Cargar información del animal seleccionado
function cargarInfoAnimal() {
    const selectAnimal = document.getElementById('vac_animal');
    const animalId = selectAnimal.value;
    const preview = document.getElementById('animal-info-preview');
    
    if (!animalId) {
        preview.innerHTML = '<p>Selecciona un animal para ver sus detalles</p>';
        return;
    }
    
    const option = selectAnimal.options[selectAnimal.selectedIndex];
    const tipo = option.dataset.tipo;
    const nombre = option.dataset.nombre;
    const raza = option.dataset.raza;
    
    preview.innerHTML = `
        <div class="animal-info">
            <div class="info-item">
                <strong>ID:</strong> #${animalId}
            </div>
            <div class="info-item">
                <strong>Tipo:</strong> ${tipo}
            </div>
            <div class="info-item">
                <strong>Nombre:</strong> ${nombre}
            </div>
            <div class="info-item">
                <strong>Raza:</strong> ${raza}
            </div>
        </div>
    `;
}

// Validar formulario de vacuna
function validarFormularioVacuna() {
    const animalId = document.getElementById('vac_animal').value;
    const medicamento = document.getElementById('vac_medicamento').value.trim();
    const cantidad = document.getElementById('vac_cantidad').value.trim();
    const via = document.getElementById('vac_via').value;
    const fecha = document.getElementById('vac_fecha').value;
    
    const errores = [];
    
    // Validar campos obligatorios
    if (!animalId) {
        errores.push('Debe seleccionar un animal');
        document.getElementById('vac_animal').classList.add('error');
    }
    
    if (!medicamento) {
        errores.push('El medicamento es obligatorio');
        document.getElementById('vac_medicamento').classList.add('error');
    }
    
    if (!cantidad) {
        errores.push('La cantidad es obligatoria');
        document.getElementById('vac_cantidad').classList.add('error');
    }
    
    if (!via) {
        errores.push('La vía de administración es obligatoria');
        document.getElementById('vac_via').classList.add('error');
    }
    
    if (!fecha) {
        errores.push('La fecha de aplicación es obligatoria');
        document.getElementById('vac_fecha').classList.add('error');
    }
    
    // Validar fecha
    if (fecha) {
        const fechaAplicacion = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fechaAplicacion > hoy) {
            errores.push('La fecha de aplicación no puede ser futura');
            document.getElementById('vac_fecha').classList.add('error');
        }
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia(
            'Validación de Vacuna',
            'Por favor corrige los siguientes errores:',
            errores.join('\n')
        );
        return null;
    }
    
    // Recopilar datos
    const datos = {
        animal_id: parseInt(animalId),
        medicamento: medicamento,
        cantidad: cantidad,
        via_administracion: via,
        fecha_aplicacion: fecha,
        observaciones: document.getElementById('vac_observaciones').value.trim() || null,
        created_at: new Date().toISOString()
    };
    
    return datos;
}

// Registrar vacuna en la base de datos
async function registrarVacuna() {
    console.log("Registrando vacuna...");
    
    // Validar formulario
    const datos = validarFormularioVacuna();
    if (!datos) {
        return;
    }
    
    try {
        mostrarLoading('Guardando vacunación...');
        
        // Insertar en la base de datos
        const { data, error } = await supabaseClient
            .from('vacunas')
            .insert([datos])
            .select()
            .single();
        
        if (error) {
            console.error("Error de Supabase:", error);
            
            // Si la tabla no existe, mostramos instrucciones para crearla
            if (error.message.includes('relation "vacunas" does not exist')) {
                throw new Error(
                    'La tabla "vacunas" no existe. Por favor créala en Supabase con:\n\n' +
                    'CREATE TABLE vacunas (\n' +
                    '  id SERIAL PRIMARY KEY,\n' +
                    '  animal_id INTEGER REFERENCES animales(id),\n' +
                    '  medicamento TEXT NOT NULL,\n' +
                    '  cantidad TEXT NOT NULL,\n' +
                    '  via_administracion TEXT NOT NULL,\n' +
                    '  fecha_aplicacion DATE NOT NULL,\n' +
                    '  observaciones TEXT,\n' +
                    '  created_at TIMESTAMP DEFAULT NOW()\n' +
                    ');'
                );
            }
            throw error;
        }
        
        ocultarLoading();
        
        // Mostrar confirmación
        const animalNombre = document.getElementById('vac_animal').options[document.getElementById('vac_animal').selectedIndex].textContent.split(' - ')[1];
        mostrarConfirmacion(`Vacunación registrada exitosamente para ${animalNombre}`);
        
        // Cerrar modal y limpiar formulario
        cerrarModalVacuna();
        
        // Actualizar lista si estamos en la pestaña de vacunas
        if (document.getElementById('tab-content-vacunas')?.classList.contains('active')) {
            await cargarVacunas();
        }
        
    } catch (error) {
        ocultarLoading();
        console.error('Error registrando vacuna:', error);
        mostrarError('Error al Registrar', 'No se pudo guardar la vacunación', error.message);
    }
}

// Cargar todas las vacunas
async function cargarVacunas() {
    console.log("Cargando vacunas...");
    const tbody = document.getElementById('vacunas-table-body');
    
    if (!tbody) {
        console.error("Elemento vacunas-table-body no encontrado");
        return;
    }
    
    mostrarLoading('Cargando registro de vacunas...');
    
    try {
        // Obtener todas las vacunas con información del animal
        const { data: vacunas, error } = await supabaseClient
            .from('vacunas')
            .select(`
                *,
                animales (
                    id,
                    tipo,
                    vacas (nombre, raza),
                    toros (nombre, raza),
                    terneros (nombre, raza)
                )
            `)
            .order('fecha_aplicacion', { ascending: false });
        
        if (error) {
            // Si la tabla no existe, mostrar mensaje amigable
            if (error.message.includes('relation "vacunas" does not exist')) {
                tbody.innerHTML = `
                    <tr><td colspan="8" class="no-data">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>La tabla de vacunas no está configurada</p>
                        <button class="btn-primary" onclick="crearTablaVacunas()">
                            <i class="fas fa-database"></i> Configurar Base de Datos
                        </button>
                    </td></tr>
                `;
                ocultarLoading();
                return;
            }
            throw error;
        }
        
        // Procesar datos
        vacunasCargadas = vacunas.map(vacuna => {
            const animal = vacuna.animales || {};
            let nombre = 'Sin nombre';
            let raza = 'Sin raza';
            
            // Obtener nombre y raza según el tipo
            if (animal.tipo === 'Vaca' && animal.vacas) {
                nombre = animal.vacas.nombre || 'Sin nombre';
                raza = animal.vacas.raza || 'Sin raza';
            } else if (animal.tipo === 'Toro' && animal.toros) {
                nombre = animal.toros.nombre || 'Sin nombre';
                raza = animal.toros.raza || 'Sin raza';
            } else if (animal.tipo === 'Ternero' && animal.terneros) {
                nombre = animal.terneros.nombre || 'Sin nombre';
                raza = animal.terneros.raza || 'Sin raza';
            }
            
            return {
                ...vacuna,
                animal_nombre: nombre,
                animal_raza: raza,
                animal_tipo: animal.tipo,
                fecha_formateada: formatearFecha(vacuna.fecha_aplicacion)
            };
        });
        
        vacunasFiltradas = [...vacunasCargadas];
        
        // Actualizar estadísticas
        actualizarEstadisticasVacunas();
        
        // Renderizar tabla
        renderizarTablaVacunas();
        
        // Generar gráficos
        generarGraficosVacunas();
        
    } catch (error) {
        console.error("Error cargando vacunas:", error);
        tbody.innerHTML = `
            <tr><td colspan="8" class="no-data error">
                <i class="fas fa-exclamation-triangle"></i> Error cargando vacunas: ${error.message}
            </td></tr>
        `;
        vacunasCargadas = [];
        vacunasFiltradas = [];
    } finally {
        ocultarLoading();
    }
}

// Actualizar estadísticas de vacunas
function actualizarEstadisticasVacunas() {
    if (vacunasCargadas.length === 0) {
        document.getElementById('stat-vacunas-total').textContent = '0';
        document.getElementById('stat-vacas-vacunadas').textContent = '0';
        document.getElementById('stat-toros-vacunados').textContent = '0';
        document.getElementById('stat-terneros-vacunados').textContent = '0';
        return;
    }
    
    const totalVacunas = vacunasCargadas.length;
    const vacasVacunadas = vacunasCargadas.filter(v => v.animal_tipo === 'Vaca').length;
    const torosVacunados = vacunasCargadas.filter(v => v.animal_tipo === 'Toro').length;
    const ternerosVacunados = vacunasCargadas.filter(v => v.animal_tipo === 'Ternero').length;
    
    document.getElementById('stat-vacunas-total').textContent = totalVacunas;
    document.getElementById('stat-vacas-vacunadas').textContent = vacasVacunadas;
    document.getElementById('stat-toros-vacunados').textContent = torosVacunados;
    document.getElementById('stat-terneros-vacunados').textContent = ternerosVacunados;
    
    // Actualizar contador
    document.getElementById('vacunas-count').textContent = `${totalVacunas} vacunaciones registradas`;
}

// Renderizar tabla de vacunas
function renderizarTablaVacunas() {
    const tbody = document.getElementById('vacunas-table-body');
    
    if (!tbody) return;
    
    if (vacunasFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" class="no-data">
                <i class="fas fa-search"></i> No se encontraron vacunaciones registradas
            </td></tr>
        `;
        actualizarPaginacionVacunas();
        return;
    }
    
    const inicio = (paginaVacunasActual - 1) * itemsPorPaginaVacunas;
    const fin = inicio + itemsPorPaginaVacunas;
    const vacunasPagina = vacunasFiltradas.slice(inicio, fin);
    
    const filasHTML = vacunasPagina.map(vacuna => {
        return `
            <tr>
                <td>
                    <strong>${vacuna.fecha_formateada}</strong>
                </td>
                <td>
                    <strong>#${vacuna.animal_id}</strong><br>
                    ${vacuna.animal_nombre}<br>
                    <small>${vacuna.animal_tipo}</small>
                </td>
                <td>${vacuna.animal_tipo}</td>
                <td>
                    <strong>${vacuna.medicamento}</strong>
                </td>
                <td>${vacuna.cantidad}</td>
                <td>${vacuna.via_administracion}</td>
                <td>${vacuna.observaciones || 'Ninguna'}</td>
                <td>
                    <div class="animal-actions">
                        <button class="btn-action btn-view" onclick="verDetalleVacuna(${vacuna.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarVacunaModal(${vacuna.id})" 
                                title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = filasHTML;
    actualizarPaginacionVacunas();
}

// Filtrar vacunas
function filtrarVacunas() {
    const busqueda = document.getElementById('vacunas-search').value.toLowerCase();
    const tipoFiltro = document.getElementById('vacunas-tipo-animal').value;
    const orden = document.getElementById('vacunas-orden').value;
    
    let resultados = vacunasCargadas.filter(vacuna => {
        // Búsqueda por animal, medicamento, etc.
        const coincideBusqueda = 
            vacuna.animal_id.toString().includes(busqueda) ||
            vacuna.animal_nombre.toLowerCase().includes(busqueda) ||
            vacuna.medicamento.toLowerCase().includes(busqueda) ||
            vacuna.observaciones?.toLowerCase().includes(busqueda);
        
        // Filtro por tipo de animal
        const coincideTipo = tipoFiltro === 'all' || vacuna.animal_tipo === tipoFiltro;
        
        return coincideBusqueda && coincideTipo;
    });
    
    // Ordenar resultados
    resultados.sort((a, b) => {
        switch (orden) {
            case 'fecha_desc':
                return new Date(b.fecha_aplicacion) - new Date(a.fecha_aplicacion);
            case 'fecha_asc':
                return new Date(a.fecha_aplicacion) - new Date(b.fecha_aplicacion);
            case 'animal':
                return a.animal_nombre.localeCompare(b.animal_nombre);
            default:
                return 0;
        }
    });
    
    vacunasFiltradas = resultados;
    paginaVacunasActual = 1;
    renderizarTablaVacunas();
}

// Resetear filtros de vacunas
function resetFiltrosVacunas() {
    document.getElementById('vacunas-search').value = '';
    document.getElementById('vacunas-tipo-animal').value = 'all';
    document.getElementById('vacunas-orden').value = 'fecha_desc';
    
    vacunasFiltradas = [...vacunasCargadas];
    paginaVacunasActual = 1;
    renderizarTablaVacunas();
}

// Paginación para vacunas
function actualizarPaginacionVacunas() {
    const totalPaginas = Math.ceil(vacunasFiltradas.length / itemsPorPaginaVacunas);
    const prevButton = document.getElementById('prev-page-vacunas');
    const nextButton = document.getElementById('next-page-vacunas');
    const pageInfo = document.getElementById('page-info-vacunas');
    
    if (prevButton && nextButton && pageInfo) {
        prevButton.disabled = paginaVacunasActual === 1;
        nextButton.disabled = paginaVacunasActual === totalPaginas || totalPaginas === 0;
        pageInfo.textContent = `Página ${paginaVacunasActual} de ${totalPaginas}`;
    }
}

function cambiarPaginaVacunas(direccion) {
    const totalPaginas = Math.ceil(vacunasFiltradas.length / itemsPorPaginaVacunas);
    const nuevaPagina = paginaVacunasActual + direccion;
    
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaVacunasActual = nuevaPagina;
        renderizarTablaVacunas();
    }
}

// Cerrar modal de vacuna
function cerrarModalVacuna() {
    const modal = document.getElementById('modal-vacuna');
    if (modal) {
        modal.classList.add('hidden');
        
        // Limpiar formulario
        const form = document.getElementById('form-vacuna');
        if (form) {
            form.reset();
        }
        
        // Resetear información
        const preview = document.getElementById('animal-info-preview');
        if (preview) {
            preview.innerHTML = '<p>Selecciona un animal para ver sus detalles</p>';
        }
    }
}

// Ver detalle de vacuna
async function verDetalleVacuna(vacunaId) {
    try {
        mostrarLoading('Cargando detalles de la vacunación...');
        
        const { data: vacuna, error } = await supabaseClient
            .from('vacunas')
            .select(`
                *,
                animales (
                    id,
                    tipo,
                    vacas (nombre, raza, edad_aproximada),
                    toros (nombre, raza, edad_aproximada),
                    terneros (nombre, raza, fecha_nacimiento)
                )
            `)
            .eq('id', vacunaId)
            .single();
        
        if (error) throw error;
        
        // Procesar datos del animal
        const animal = vacuna.animales || {};
        let nombre = 'Sin nombre';
        let raza = 'Sin raza';
        let infoAdicional = '';
        
        if (animal.tipo === 'Vaca' && animal.vacas) {
            nombre = animal.vacas.nombre || 'Sin nombre';
            raza = animal.vacas.raza || 'Sin raza';
            infoAdicional = `Edad: ${animal.vacas.edad_aproximada || 'N/A'} años`;
        } else if (animal.tipo === 'Toro' && animal.toros) {
            nombre = animal.toros.nombre || 'Sin nombre';
            raza = animal.toros.raza || 'Sin raza';
            infoAdicional = `Edad: ${animal.toros.edad_aproximada || 'N/A'} años`;
        } else if (animal.tipo === 'Ternero' && animal.terneros) {
            nombre = animal.terneros.nombre || 'Sin nombre';
            raza = animal.terneros.raza || 'Sin raza';
            const fechaNacimiento = animal.terneros.fecha_nacimiento ? 
                formatearFecha(animal.terneros.fecha_nacimiento) : 'N/A';
            infoAdicional = `Nacimiento: ${fechaNacimiento}`;
        }
        
        // Crear HTML de detalles
        const detallesHTML = `
            <div class="vacuna-detalles">
                <div class="detalle-seccion">
                    <h4><i class="fas fa-syringe"></i> Información de la Vacunación</h4>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <span class="detalle-label">Medicamento:</span>
                            <span class="detalle-value"><strong>${vacuna.medicamento}</strong></span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Cantidad:</span>
                            <span class="detalle-value">${vacuna.cantidad}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Vía:</span>
                            <span class="detalle-value">${vacuna.via_administracion}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Fecha Aplicación:</span>
                            <span class="detalle-value">${formatearFecha(vacuna.fecha_aplicacion)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detalle-seccion">
                    <h4><i class="fas fa-cow"></i> Información del Animal</h4>
                    <div class="detalle-grid">
                        <div class="detalle-item">
                            <span class="detalle-label">ID:</span>
                            <span class="detalle-value">#${animal.id}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Nombre:</span>
                            <span class="detalle-value">${nombre}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Tipo:</span>
                            <span class="detalle-value">${animal.tipo}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Raza:</span>
                            <span class="detalle-value">${raza}</span>
                        </div>
                        <div class="detalle-item">
                            <span class="detalle-label">Información:</span>
                            <span class="detalle-value">${infoAdicional}</span>
                        </div>
                    </div>
                </div>
                
                ${vacuna.observaciones ? `
                <div class="detalle-seccion">
                    <h4><i class="fas fa-sticky-note"></i> Observaciones</h4>
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        ${vacuna.observaciones}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Mostrar en modal
        document.getElementById('vacuna-detail-body').innerHTML = detallesHTML;
        document.getElementById('btn-eliminar-vacuna').onclick = () => eliminarVacunaModal(vacunaId, nombre);
        document.getElementById('vacuna-detail-modal').classList.remove('hidden');
        
        ocultarLoading();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error cargando detalles de vacuna:', error);
        mostrarError('Error', 'No se pudieron cargar los detalles de la vacunación', error.message);
    }
}

// Cerrar modal de detalle de vacuna
function cerrarModalDetalleVacuna() {
    document.getElementById('vacuna-detail-modal').classList.add('hidden');
    document.getElementById('vacuna-detail-body').innerHTML = '';
}

// Eliminar vacuna (modal de confirmación)
function eliminarVacunaModal(vacunaId, nombreAnimal = null) {
    if (!nombreAnimal) {
        nombreAnimal = 'esta vacunación';
    }
    
    mostrarAdvertencia(
        'Confirmar Eliminación',
        `¿Estás seguro de eliminar el registro de vacunación?`,
        `Esta acción no se puede deshacer. Se eliminará el registro de vacunación para ${nombreAnimal}.`,
        async () => {
            try {
                mostrarLoading('Eliminando registro de vacunación...');
                
                const { error } = await supabaseClient
                    .from('vacunas')
                    .delete()
                    .eq('id', vacunaId);
                
                if (error) throw error;
                
                cerrarModalDetalleVacuna();
                ocultarLoading();
                mostrarConfirmacion('Registro de vacunación eliminado correctamente');
                
                // Actualizar lista
                await cargarVacunas();
                
            } catch (error) {
                ocultarLoading();
                console.error('Error eliminando vacuna:', error);
                mostrarError('Error al Eliminar', 'No se pudo eliminar el registro de vacunación', error.message);
            }
        }
    );
}

// Generar gráficos de vacunas
function generarGraficosVacunas() {
    // Destruir gráficos existentes
    if (charts.vacunasMensuales) charts.vacunasMensuales.destroy();
    if (charts.vacunasTipoAnimal) charts.vacunasTipoAnimal.destroy();
    
    // Gráfico de vacunas por mes
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const vacunasMensuales = new Array(12).fill(0);
    
    vacunasCargadas.forEach(vacuna => {
        if (vacuna.fecha_aplicacion) {
            const fecha = new Date(vacuna.fecha_aplicacion);
            const mes = fecha.getMonth();
            vacunasMensuales[mes]++;
        }
    });
    
    const ctxMensual = document.getElementById('chart-vacunas-mensuales')?.getContext('2d');
    if (ctxMensual) {
        charts.vacunasMensuales = new Chart(ctxMensual, {
            type: 'bar',
            data: {
                labels: meses,
                datasets: [{
                    label: 'Vacunaciones',
                    data: vacunasMensuales,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: '#36a2eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Gráfico de distribución por tipo de animal
    const tiposCount = {
        'Vaca': vacunasCargadas.filter(v => v.animal_tipo === 'Vaca').length,
        'Toro': vacunasCargadas.filter(v => v.animal_tipo === 'Toro').length,
        'Ternero': vacunasCargadas.filter(v => v.animal_tipo === 'Ternero').length
    };
    
    const ctxTipoAnimal = document.getElementById('chart-vacunas-tipo-animal')?.getContext('2d');
    if (ctxTipoAnimal) {
        charts.vacunasTipoAnimal = new Chart(ctxTipoAnimal, {
            type: 'pie',
            data: {
                labels: ['Vacas', 'Toros', 'Terneros'],
                datasets: [{
                    data: [tiposCount.Vaca, tiposCount.Toro, tiposCount.Ternero],
                    backgroundColor: [
                        '#2e7d32', // Verde para vacas
                        '#ff9800', // Naranja para toros
                        '#2196f3'  // Azul para terneros
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Exportar vacunas a CSV
function exportarVacunasCSV() {
    if (vacunasCargadas.length === 0) {
        mostrarAdvertencia('Sin Datos', 'No hay vacunaciones registradas para exportar.');
        return;
    }
    
    try {
        mostrarLoading('Generando reporte de vacunaciones...');
        
        const headers = [
            'ID Vacuna', 'ID Animal', 'Nombre Animal', 'Tipo Animal', 'Raza',
            'Medicamento', 'Cantidad', 'Vía Administración', 'Fecha Aplicación',
            'Observaciones', 'Fecha Registro'
        ];
        
        const csvData = vacunasCargadas.map(vacuna => {
            return [
                vacuna.id,
                vacuna.animal_id,
                vacuna.animal_nombre,
                vacuna.animal_tipo,
                vacuna.animal_raza,
                vacuna.medicamento,
                vacuna.cantidad,
                vacuna.via_administracion,
                vacuna.fecha_aplicacion,
                vacuna.observaciones || '',
                vacuna.created_at ? new Date(vacuna.created_at).toLocaleDateString() : ''
            ];
        });
        
        const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const fechaActual = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `vacunaciones_${fechaActual}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        ocultarLoading();
        mostrarConfirmacion('Reporte de vacunaciones generado exitosamente');
        
    } catch (error) {
        ocultarLoading();
        console.error('Error generando reporte:', error);
        mostrarError('Error', 'No se pudo generar el reporte de vacunaciones', error.message);
    }
}

// Función para crear la tabla de vacunas si no existe
async function crearTablaVacunas() {
    mostrarLoading('Configurando base de datos...');
    
    try {
        // Mostrar instrucciones
        mostrarAdvertencia(
            'Configuración de Base de Datos',
            'La tabla de vacunas no existe en Supabase',
            `Para crear la tabla, ejecuta este SQL en el editor de SQL de Supabase:

CREATE TABLE vacunas (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animales(id),
    medicamento TEXT NOT NULL,
    cantidad TEXT NOT NULL,
    via_administracion TEXT NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Luego recarga la página.`,
            () => {
                ocultarLoading();
                window.open('https://app.supabase.com/project/kuipquqixbgphvsnnoku/editor', '_blank');
            }
        );
        
    } catch (error) {
        ocultarLoading();
        console.error('Error configurando tabla:', error);
        mostrarError('Error', 'No se pudo configurar la base de datos', error.message);
    }
}

// ================= VALIDACIÓN EN TIEMPO REAL MEJORADA =================
function configurarValidacionTiempoRealMejorada() {
    // Configurar para todos los inputs de ID
    document.querySelectorAll('input[type="number"][id$="_id"]').forEach(input => {
        input.addEventListener('input', debounce(async (e) => {
            await validarCampoIdMejorado(e.target);
        }, 600));
    });
    
    // Configurar para campos de texto
    document.querySelectorAll('input[type="text"], textarea').forEach(input => {
        input.addEventListener('input', debounce((e) => {
            validarCampoTexto(e.target);
        }, 500));
    });
    
    // Configurar para campos numéricos
    document.querySelectorAll('input[type="number"]:not([id$="_id"])').forEach(input => {
        input.addEventListener('input', debounce((e) => {
            validarCampoNumero(e.target);
        }, 500));
    });
    
    // Configurar para fechas
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.addEventListener('change', debounce((e) => {
            validarCampoFecha(e.target);
        }, 300));
    });
}

async function validarCampoIdMejorado(input) {
    const valor = input.value.trim();
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    
    // Limpiar estados anteriores
    formGroup.classList.remove('error', 'success', 'warning');
    const mensajes = formGroup.querySelectorAll('.error-text, .success-text, .warning-text, .validation-badge');
    mensajes.forEach(msg => msg.remove());
    
    if (!valor) {
        mostrarEstadoCampo(formGroup, 'info', 'ID requerido');
        return;
    }
    
    // Validar formato básico
    const validacionFormato = validarFormatoId(valor);
    if (!validacionFormato.valida) {
        mostrarEstadoCampo(formGroup, 'error', validacionFormato.mensaje);
        return;
    }
    
    // Mostrar estado de verificación
    const badge = document.createElement('div');
    badge.className = 'validation-badge checking';
    badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando disponibilidad...';
    formGroup.appendChild(badge);
    
    try {
        // Verificar disponibilidad con timeout
        const resultado = await ejecutarConTimeout(
            validarIdUnico(valor, obtenerTipoAnimalPorCampo(input.id)),
            5000,
            'Timeout verificando ID'
        );
        
        badge.remove();
        
        if (resultado.disponible) {
            mostrarEstadoCampo(formGroup, 'success', resultado.mensaje);
        } else {
            mostrarEstadoCampo(formGroup, 'error', resultado.mensaje);
        }
    } catch (error) {
        badge.remove();
        mostrarEstadoCampo(formGroup, 'warning', 
            'No se pudo verificar el ID. Puede que ya esté en uso.');
    }
}

function validarCampoTexto(input) {
    const valor = input.value;
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    
    // Solo validar si no es campo opcional vacío
    if (!valor && !input.hasAttribute('required')) return;
    
    const maxLength = input.getAttribute('maxlength') || 100;
    const validacion = validarLongitud(valor, maxLength, input.previousElementSibling?.textContent || 'Campo');
    
    if (!validacion.valida) {
        mostrarEstadoCampo(formGroup, 'error', validacion.mensaje);
    } else {
        formGroup.classList.remove('error');
        const errorMsg = formGroup.querySelector('.error-text');
        if (errorMsg) errorMsg.remove();
    }
}

function validarCampoNumero(input) {
    const valor = input.value;
    const formGroup = input.closest('.form-group');
    if (!formGroup || (!valor && !input.hasAttribute('required'))) return;
    
    const min = parseInt(input.getAttribute('min')) || 0;
    const max = parseInt(input.getAttribute('max')) || 100;
    const campoNombre = input.previousElementSibling?.textContent || 'Campo';
    
    const validacion = validarRango(valor, min, max, campoNombre);
    
    if (!validacion.valida) {
        mostrarEstadoCampo(formGroup, 'error', validacion.mensaje);
    } else {
        formGroup.classList.remove('error');
        const errorMsg = formGroup.querySelector('.error-text');
        if (errorMsg) errorMsg.remove();
    }
}

function validarCampoFecha(input) {
    const valor = input.value;
    const formGroup = input.closest('.form-group');
    if (!formGroup || (!valor && !input.hasAttribute('required'))) return;
    
    const validacion = validarFecha(valor);
    
    if (!validacion.valida) {
        mostrarEstadoCampo(formGroup, 'error', validacion.mensaje);
    } else {
        formGroup.classList.remove('error');
        const errorMsg = formGroup.querySelector('.error-text');
        if (errorMsg) errorMsg.remove();
    }
}

function mostrarEstadoCampo(formGroup, tipo, mensaje) {
    formGroup.classList.remove('error', 'success', 'warning', 'info');
    formGroup.classList.add(tipo);
    
    const mensajeAnterior = formGroup.querySelector('.error-text, .success-text, .warning-text, .info-text');
    if (mensajeAnterior) mensajeAnterior.remove();
    
    const msgElement = document.createElement('div');
    msgElement.className = `${tipo}-text`;
    
    let icono = '';
    switch (tipo) {
        case 'success': icono = 'fa-check-circle'; break;
        case 'error': icono = 'fa-times-circle'; break;
        case 'warning': icono = 'fa-exclamation-triangle'; break;
        case 'info': icono = 'fa-info-circle'; break;
    }
    
    msgElement.innerHTML = `<i class="fas ${icono}"></i> ${mensaje}`;
    formGroup.appendChild(msgElement);
}

// ================= CONFIGURACIÓN INICIAL =================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Configurar límites de fecha
    const fechaInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    
    fechaInputs.forEach(input => {
        input.max = today;
        input.min = '2000-01-01';
    });
    
    // Configurar validaciones
    configurarValidacionTiempoReal();
    configurarValidacionTiempoRealMejorada();
    
    // Configurar eventos para prenadas
    const fechaPrenadaInput = document.getElementById('p_fecha');
    if (fechaPrenadaInput) {
        const hoy = new Date().toISOString().split('T')[0];
        fechaPrenadaInput.max = hoy;
        fechaPrenadaInput.min = '2000-01-01';
    }
    
    // Evento para pestaña de prenadas
    const tabPrenadas = document.getElementById('tab-prenadas');
    if (tabPrenadas) {
        tabPrenadas.addEventListener('click', function() {
            setTimeout(() => {
                if (document.getElementById('tab-content-prenadas').classList.contains('active')) {
                    cargarPrenadas();
                }
            }, 100);
        });
    }
    
    // Evento para pestaña de historial
    const tabHistorial = document.getElementById('tab-historial');
    if (tabHistorial) {
        tabHistorial.addEventListener('click', function() {
            setTimeout(() => {
                if (document.getElementById('tab-content-historial').classList.contains('active')) {
                    cargarHistorialPartos();
                }
            }, 100);
        });
    }
    
    // Verificar conexión inicial
    setTimeout(async () => {
        const { conectado, mensaje } = await verificarConexionSupabase();
        if (!conectado) {
            mostrarToast('warning', 'Conectando...', 
                'Verificando conexión con la base de datos');
        }
    }, 1000);
    
    // Iniciar verificaciones periódicas
    iniciarVerificacionesPeriodicas();
    
    console.log('Sistema de ganado inicializado correctamente');
    console.log('Sistema de prenadas inicializado correctamente');
    console.log('Sistema de historial de partos listo');
});

function configurarValidacionTiempoReal() {
    const idVaca = document.getElementById('v_id');
    const idToro = document.getElementById('t_id');
    const idTernero = document.getElementById('te_id');
    const padreInput = document.getElementById('te_padre');
    const madreInput = document.getElementById('te_madre');
    
    if (idVaca) idVaca.addEventListener('input', debounce(async () => await validarCampoId(idVaca, 'v_id'), 500));
    if (idToro) idToro.addEventListener('input', debounce(async () => await validarCampoId(idToro, 't_id'), 500));
    if (idTernero) idTernero.addEventListener('input', debounce(async () => await validarCampoId(idTernero, 'te_id'), 500));
    if (padreInput) padreInput.addEventListener('input', debounce(async () => await validarPadreMadreCampo(padreInput, 'Padre'), 500));
    if (madreInput) madreInput.addEventListener('input', debounce(async () => await validarPadreMadreCampo(madreInput, 'Madre'), 500));
}