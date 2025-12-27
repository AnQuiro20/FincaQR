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

// ================= SISTEMA DE MENSAJES =================

// Mostrar mensaje de error
function mostrarError(titulo, mensaje, detalles = '') {
    // Cerrar cualquier modal abierto primero
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
    
    // Agregar animación de shake
    const errorContent = document.querySelector('.error-content');
    errorContent.classList.add('shake');
    setTimeout(() => {
        errorContent.classList.remove('shake');
    }, 500);
}

// Cerrar mensaje de error
function cerrarError() {
    document.getElementById('error-message').classList.add('hidden');
}

// Reintentar última operación
function reintentarOperacion() {
    cerrarError();
    if (ultimaOperacion && datosPendientes) {
        setTimeout(() => {
            ultimaOperacion(...datosPendientes);
        }, 300);
    }
}

// Mostrar advertencia
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
    
    // Guardar callback para continuar
    window.continuarOperacion = callbackContinuar || function() {
        cerrarAdvertencia();
    };
    
    // Configurar botón de continuar
    const btnContinuar = document.querySelector('#warning-message .btn-error-primary');
    if (btnContinuar && callbackContinuar) {
        btnContinuar.onclick = () => {
            if (callbackContinuar) {
                callbackContinuar();
            }
        };
    }
    
    // Configurar botón de cancelar para cerrar el modal
    const btnCancelar = document.querySelector('#warning-message .btn-error-secondary');
    if (btnCancelar) {
        btnCancelar.onclick = cerrarAdvertencia;
    }
    
    document.getElementById('warning-message').classList.remove('hidden');
}

// Cerrar advertencia
function cerrarAdvertencia() {
    document.getElementById('warning-message').classList.add('hidden');
    // Limpiar callbacks
    window.continuarOperacion = null;
}
// ================= FUNCIÓN continuarOperacion =================

function continuarOperacion() {
    if (window.continuarOperacion && typeof window.continuarOperacion === 'function') {
        window.continuarOperacion();
    }
    cerrarAdvertencia();
}

// Mostrar loading
function mostrarLoading(mensaje = 'Procesando...') {
    document.getElementById('loading-text').textContent = mensaje;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

// Ocultar loading
function ocultarLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// ================= VALIDACIONES EN TIEMPO REAL =================

// Validar que un ID sea único
async function validarIdUnico(id, tipoAnimal) {
    try {
        const { data, error } = await supabaseClient
            .from('animales')
            .select('id')
            .eq('id', parseInt(id));
        
        if (error) throw error;
        
        return {
            disponible: data.length === 0,
            mensaje: data.length === 0 
                ? 'ID disponible' 
                : `ID ya registrado para otro animal`
        };
    } catch (error) {
        console.error('Error validando ID:', error);
        return { disponible: false, mensaje: 'Error validando ID' };
    }
}

// Validar que padre/madre existan
async function validarPadreMadre(id, tipo) {
    try {
        const { data, error } = await supabaseClient
            .from('animales')
            .select('id, tipo')
            .eq('id', parseInt(id));
        
        if (error) throw error;
        
        if (data.length === 0) {
            return { existe: false, mensaje: `${tipo} no encontrado` };
        }
        
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

// ================= MANEJO DE EVENTOS EN TIEMPO REAL =================

document.addEventListener('DOMContentLoaded', function() {
    // Establecer año actual en el footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Establecer fecha mínima para fecha de nacimiento
    const fechaInput = document.getElementById('te_fecha');
    if (fechaInput) {
        const today = new Date().toISOString().split('T')[0];
        fechaInput.max = today;
        fechaInput.min = '2000-01-01';
    }
    
    // Configurar validación en tiempo real para IDs
    configurarValidacionTiempoReal();

  // Agregar listener para debug
    console.log('Sistema de ganado inicializado');
    
    // Exponer funciones globales para debugging
    window.debug = {
        animalesCargados: () => animalesCargados,
        animalEditando: () => animalEditando,
        modoEdicion: () => modoEdicion,
        limpiarEstado: () => {
            modoEdicion = false;
            animalEditando = null;
            console.log('Estado limpiado');
        }
    };
});

function configurarValidacionTiempoReal() {
    // IDs de vacas
    const idVaca = document.getElementById('v_id');
    if (idVaca) {
        idVaca.addEventListener('input', debounce(async () => {
            await validarCampoId(idVaca, 'v_id');
        }, 500));
    }
    
    // IDs de toros
    const idToro = document.getElementById('t_id');
    if (idToro) {
        idToro.addEventListener('input', debounce(async () => {
            await validarCampoId(idToro, 't_id');
        }, 500));
    }
    
    // IDs de terneros
    const idTernero = document.getElementById('te_id');
    if (idTernero) {
        idTernero.addEventListener('input', debounce(async () => {
            await validarCampoId(idTernero, 'te_id');
        }, 500));
    }
    
    // Validar padre/madre en tiempo real
    const padreInput = document.getElementById('te_padre');
    const madreInput = document.getElementById('te_madre');
    
    if (padreInput) {
        padreInput.addEventListener('input', debounce(async () => {
            await validarPadreMadreCampo(padreInput, 'Padre');
        }, 500));
    }
    
    if (madreInput) {
        madreInput.addEventListener('input', debounce(async () => {
            await validarPadreMadreCampo(madreInput, 'Madre');
        }, 500));
    }
}

// Debounce para evitar muchas llamadas API
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
    
    // Limpiar estados previos
    formGroup.classList.remove('error', 'success');
    
    // Eliminar mensajes anteriores
    const mensajeAnterior = formGroup.querySelector('.error-text, .success-text, .validation-badge');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    if (!valor) {
        formGroup.classList.remove('error', 'success');
        return;
    }
    
    if (isNaN(valor) || parseInt(valor) <= 0) {
        marcarError(formGroup, 'El ID debe ser un número mayor que 0');
        return;
    }
    
    // Mostrar estado de validación
    const badge = document.createElement('div');
    badge.className = 'validation-badge checking';
    badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    formGroup.appendChild(badge);
    setTimeout(() => badge.classList.add('show'), 10);
    
    try {
        const resultado = await validarIdUnico(valor, obtenerTipoAnimalPorCampo(campoId));
        
        // Remover badge de verificación
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
    
    // Limpiar estados previos
    formGroup.classList.remove('error', 'success');
    
    // Eliminar mensajes anteriores
    const mensajeAnterior = formGroup.querySelector('.error-text, .success-text');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    if (!valor) {
        return;
    }
    
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
    const id = document.getElementById('v_id').value;
    const raza = document.getElementById('v_raza').value;
    const errores = [];
    
    if (!id.trim()) {
        errores.push('El ID es obligatorio');
        marcarCampoError('v_id', 'ID requerido');
    } else if (isNaN(id) || parseInt(id) <= 0) {
        errores.push('El ID debe ser un número válido mayor que 0');
        marcarCampoError('v_id', 'ID inválido');
    }
    
    if (!raza.trim()) {
        errores.push('La raza es obligatoria');
        marcarCampoError('v_raza', 'Raza requerida');
    }
    
    // Validar edad si se proporciona
    const edad = document.getElementById('v_edad').value;
    if (edad && (isNaN(edad) || parseInt(edad) < 0 || parseInt(edad) > 30)) {
        errores.push('La edad debe estar entre 0 y 30 años');
        marcarCampoError('v_edad', 'Edad inválida');
    }
    
    // Validar partos si se proporciona
    const partos = document.getElementById('v_partos').value;
    if (partos && (isNaN(partos) || parseInt(partos) < 0)) {
        errores.push('El número de partos debe ser positivo');
        marcarCampoError('v_partos', 'Partos inválidos');
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia(
            'Validación de Vaca',
            'Por favor corrige los siguientes errores:',
            errores.join('\n')
        );
        return false;
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
    
    // Validar edad si se proporciona
    const edad = document.getElementById('t_edad').value;
    if (edad && (isNaN(edad) || parseInt(edad) < 0 || parseInt(edad) > 20)) {
        errores.push('La edad debe estar entre 0 y 20 años');
        marcarCampoError('t_edad', 'Edad inválida');
    }
    
    if (errores.length > 0) {
        mostrarAdvertencia(
            'Validación de Toro',
            'Por favor corrige los siguientes errores:',
            errores.join('\n')
        );
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
    
    // Validar fecha si se proporciona
    const fecha = document.getElementById('te_fecha').value;
    if (fecha) {
        const fechaNacimiento = new Date(fecha);
        const hoy = new Date();
        if (fechaNacimiento > hoy) {
            errores.push('La fecha de nacimiento no puede ser futura');
            marcarCampoError('te_fecha', 'Fecha inválida');
        }
    }
    
    // Validar padre si se proporciona
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
    
    // Validar madre si se proporciona
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
        mostrarAdvertencia(
            'Validación de Ternero',
            'Por favor corrige los siguientes errores:',
            errores.join('\n')
        );
        return false;
    }
    
    return true;
}

function marcarCampoError(campoId, mensaje) {
    const input = document.getElementById(campoId);
    const formGroup = input.closest('.form-group');
    
    if (formGroup) {
        formGroup.classList.add('error');
        
        // Eliminar mensaje anterior si existe
        const mensajeAnterior = formGroup.querySelector('.error-text');
        if (mensajeAnterior) {
            mensajeAnterior.remove();
        }
        
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-text';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${mensaje}`;
        formGroup.appendChild(errorMsg);
        
        // Scroll al campo con error
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

// ================= FUNCIONES DE GUARDADO MEJORADAS =================

async function guardarVaca() {
    limpiarErrores();
    
    if (!await validarCamposVaca()) return;
    
    const id = document.getElementById('v_id').value;
    
    // Verificar ID único antes de proceder
    mostrarLoading('Verificando disponibilidad del ID...');
    
    try {
        const validacionId = await validarIdUnico(id, 'Vaca');
        
        if (!validacionId.disponible) {
            ocultarLoading();
            mostrarAdvertencia(
                'ID Duplicado',
                'El ID ingresado ya está en uso',
                validacionId.mensaje,
                () => {
                    document.getElementById('v_id').focus();
                    document.getElementById('v_id').select();
                }
            );
            return;
        }
        
        mostrarLoading('Guardando vaca...');
        
        // Guardar operación para posible reintento
        ultimaOperacion = guardarVaca;
        datosPendientes = [];
        
        // 1. Insertar en animales
        const { error: errorAnimal } = await supabaseClient
            .from('animales')
            .insert([{
                id: parseInt(id),
                tipo: 'Vaca'
            }]);
        
        if (errorAnimal) {
            throw new Error(`Error en tabla animales: ${errorAnimal.message}`);
        }

        // 2. Insertar en vacas
        const { error: errorVaca } = await supabaseClient
            .from('vacas')
            .insert([{
                id: parseInt(id),
                raza: document.getElementById('v_raza').value,
                nombre: document.getElementById('v_nombre').value || null,
                edad_aproximada: document.getElementById('v_edad').value 
                    ? parseInt(document.getElementById('v_edad').value) 
                    : null,
                total_partos: document.getElementById('v_partos').value 
                    ? parseInt(document.getElementById('v_partos').value) 
                    : null,
                observaciones: document.getElementById('v_obs').value || null
            }]);
        
        if (errorVaca) {
            throw new Error(`Error en tabla vacas: ${errorVaca.message}`);
        }
        
        ocultarLoading();
        
        const nombreVaca = document.getElementById('v_nombre').value || 'Sin nombre';
        mostrarConfirmacion(`Vaca "${nombreVaca}" registrada correctamente con ID: ${id}`);
        limpiarFormularioVaca();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        
        mostrarError(
            'Error al Guardar',
            'No se pudo registrar la vaca en el sistema',
            error.message
        );
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
            mostrarAdvertencia(
                'ID Duplicado',
                'El ID ingresado ya está en uso',
                validacionId.mensaje,
                () => {
                    document.getElementById('t_id').focus();
                    document.getElementById('t_id').select();
                }
            );
            return;
        }
        
        mostrarLoading('Guardando toro...');
        
        ultimaOperacion = guardarToro;
        datosPendientes = [];
        
        // 1. Insertar en animales
        const { error: errorAnimal } = await supabaseClient
            .from('animales')
            .insert([{
                id: parseInt(id),
                tipo: 'Toro'
            }]);
        
        if (errorAnimal) {
            throw new Error(`Error en tabla animales: ${errorAnimal.message}`);
        }

        // 2. Insertar en toros
        const { error: errorToro } = await supabaseClient
            .from('toros')
            .insert([{
                id: parseInt(id),
                raza: document.getElementById('t_raza').value,
                nombre: document.getElementById('t_nombre').value || null,
                edad_aproximada: document.getElementById('t_edad').value 
                    ? parseInt(document.getElementById('t_edad').value) 
                    : null
            }]);
        
        if (errorToro) {
            throw new Error(`Error en tabla toros: ${errorToro.message}`);
        }
        
        ocultarLoading();
        
        const nombreToro = document.getElementById('t_nombre').value || 'Sin nombre';
        mostrarConfirmacion(`Toro "${nombreToro}" registrado correctamente con ID: ${id}`);
        limpiarFormularioToro();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        
        mostrarError(
            'Error al Guardar',
            'No se pudo registrar el toro en el sistema',
            error.message
        );
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
            mostrarAdvertencia(
                'ID Duplicado',
                'El ID ingresado ya está en uso',
                validacionId.mensaje,
                () => {
                    document.getElementById('te_id').focus();
                    document.getElementById('te_id').select();
                }
            );
            return;
        }
        
        mostrarLoading('Guardando ternero...');
        
        ultimaOperacion = guardarTernero;
        datosPendientes = [];
        
        // 1. Insertar en animales
        const { error: errorAnimal } = await supabaseClient
            .from('animales')
            .insert([{
                id: parseInt(id),
                tipo: 'Ternero'
            }]);
        
        if (errorAnimal) {
            throw new Error(`Error en tabla animales: ${errorAnimal.message}`);
        }

        // 2. Insertar en terneros
        const padreValue = document.getElementById('te_padre').value;
        const madreValue = document.getElementById('te_madre').value;
        
        const { error: errorTernero } = await supabaseClient
            .from('terneros')
            .insert([{
                id: parseInt(id),
                raza: document.getElementById('te_raza').value,
                nombre: document.getElementById('te_nombre').value || null,
                genero: document.getElementById('te_genero').value,
                fecha_nacimiento: document.getElementById('te_fecha').value || null,
                padre: padreValue && !isNaN(padreValue) ? parseInt(padreValue) : null,
                madre: madreValue && !isNaN(madreValue) ? parseInt(madreValue) : null
            }]);
        
        if (errorTernero) {
            throw new Error(`Error en tabla terneros: ${errorTernero.message}`);
        }
        
        ocultarLoading();
        
        const nombreTernero = document.getElementById('te_nombre').value || 'Sin nombre';
        mostrarConfirmacion(`Ternero/a "${nombreTernero}" registrado correctamente con ID: ${id}`);
        limpiarFormularioTernero();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error:', error);
        
        mostrarError(
            'Error al Guardar',
            'No se pudo registrar el ternero en el sistema',
            error.message
        );
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
            edad_aproximada: document.getElementById('v_edad').value 
                ? parseInt(document.getElementById('v_edad').value) 
                : null,
            total_partos: document.getElementById('v_partos').value 
                ? parseInt(document.getElementById('v_partos').value) 
                : null,
            observaciones: document.getElementById('v_obs').value || null
        };
        
        console.log('Datos a actualizar:', datosActualizados);
        
        // Actualizar en la tabla de vacas
        const { error } = await supabaseClient
            .from('vacas')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        // Actualizar lista local
        await cargarAnimales();
        
        ocultarLoading();
        
        mostrarConfirmacion(`Vaca actualizada correctamente`);
        
        // Limpiar y regresar a consulta
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando vaca:', error);
        mostrarError(
            'Error al Actualizar',
            'No se pudo actualizar la vaca',
            error.message
        );
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
            edad_aproximada: document.getElementById('t_edad').value 
                ? parseInt(document.getElementById('t_edad').value) 
                : null
        };
        
        console.log('Datos a actualizar:', datosActualizados);
        
        const { error } = await supabaseClient
            .from('toros')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        // Actualizar lista local
        await cargarAnimales();
        
        ocultarLoading();
        
        mostrarConfirmacion(`Toro actualizado correctamente`);
        
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando toro:', error);
        mostrarError(
            'Error al Actualizar',
            'No se pudo actualizar el toro',
            error.message
        );
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
        
        const { error } = await supabaseClient
            .from('terneros')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        // Actualizar lista local
        await cargarAnimales();
        
        ocultarLoading();
        
        mostrarConfirmacion(`Ternero actualizado correctamente`);
        
        cancelarEdicion();
        
    } catch (error) {
        ocultarLoading();
        console.error('Error actualizando ternero:', error);
        mostrarError(
            'Error al Actualizar',
            'No se pudo actualizar el ternero',
            error.message
        );
    }
}
// ================= FUNCIONES DE INTERFAZ EXISTENTES =================

function mostrarFormulario(tipo) {
    limpiarErrores();
    
    // Si estamos en modo edición y se selecciona otro tipo, cancelar edición
    if (modoEdicion && tipo !== animalEditando?.tipo?.toLowerCase()) {
        const confirmar = confirm('¿Desea cancelar la edición actual? Los cambios no guardados se perderán.');
        if (confirmar) {
            cancelarEdicion();
        } else {
            return;
        }
    }
    
    // Si no estamos editando, proceder normalmente
    if (!modoEdicion) {
        ocultarFormularios();
        tipoFormularioActual = tipo;
        
        const form = document.getElementById(`form-${tipo}`);
        const title = document.getElementById('form-title');
        const subtitle = document.getElementById('form-subtitle');
        
        if (form) {
            form.classList.remove('hidden');
            
            const nombres = {
                'vaca': 'Vaca',
                'toro': 'Toro',
                'ternero': 'Ternero/a'
            };
            
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
    
    // Ocultar todos los formularios
    document.querySelectorAll('.animal-form').forEach(form => {
        form.classList.add('hidden');
    });
    
    // Restaurar títulos por defecto
    document.getElementById('form-title').textContent = 'Selecciona un tipo de animal';
    document.getElementById('form-subtitle').textContent = 'Haz clic en una de las tarjetas para comenzar el registro';
    
    // Quitar selección de tarjetas
    document.querySelectorAll('.animal-card').forEach(card => {
        card.classList.remove('selected');
        card.style.borderColor = '';
        card.style.boxShadow = '';
    });
}

function mostrarConfirmacion(mensaje) {
    // Asegurarse de que cualquier modal abierto se cierre primero
    cerrarAdvertencia();
    cerrarError();
    
    document.getElementById('confirmation-text').textContent = mensaje;
    document.getElementById('confirmation-message').classList.remove('hidden');
    
    // Limpiar formulario después de 3 segundos si estamos en pestaña de registro
    setTimeout(() => {
        const confirmacion = document.getElementById('confirmation-message');
        if (confirmacion && !confirmacion.classList.contains('hidden')) {
            cerrarConfirmacion();
        }
    }, 3000);
}

function cerrarConfirmacion() {
    document.getElementById('confirmation-message').classList.add('hidden');
    
    // Solo ocultar formularios si estamos en la pestaña de registro
    if (document.getElementById('tab-registro').classList.contains('active')) {
        ocultarFormularios();
    }
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
    
    // Eliminar botón de cancelar edición si existe
    const btnCancelar = document.querySelector('#form-vaca #btn-cancelar-edicion');
    if (btnCancelar) {
        btnCancelar.remove();
    }
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
    if (btnCancelar) {
        btnCancelar.remove();
    }
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
    if (btnCancelar) {
        btnCancelar.remove();
    }
}

// ================= SISTEMA DE PESTAÑAS =================

let animalesCargados = [];
let animalesFiltrados = [];
let paginaActual = 1;
const itemsPorPagina = 10;
let charts = {};

function cambiarTab(tabId) {
    console.log('Cambiando a pestaña:', tabId);
    
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Quitar activo de todas las pestañas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activar nueva pestaña
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`tab-content-${tabId}`).classList.add('active');
    
    // Si vamos a consulta, cargar animales
    if (tabId === 'consulta') {
        cargarAnimales();
    }
    // Si vamos a estadísticas, cargarlas
    else if (tabId === 'estadisticas') {
        cargarEstadisticas();
    }
    // Si vamos a registro, asegurarse de que esté limpio
    else if (tabId === 'registro') {
        limpiarTodosLosFormularios();
        restaurarBotonesOriginales();
    }
}
// ================= MODIFICAR FUNCIONES DE LIMPIEZA =================

function limpiarFormularioVaca() {
    ['v_id', 'v_raza', 'v_nombre', 'v_edad', 'v_partos', 'v_obs'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            element.disabled = false;
        }
    });
    
    // Eliminar botón de cancelar edición si existe
    const btnCancelar = document.querySelector('#form-vaca #btn-cancelar-edicion');
    if (btnCancelar) {
        btnCancelar.remove();
    }
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
    if (btnCancelar) {
        btnCancelar.remove();
    }
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
    if (btnCancelar) {
        btnCancelar.remove();
    }
}

// ================= GESTIÓN DE ANIMALES REGISTRADOS =================

async function cargarAnimales() {
    mostrarLoading('Cargando animales registrados...');
    
    try {
        // Cargar todos los animales con sus detalles específicos
        const { data: animales, error: errorAnimales } = await supabaseClient
            .from('animales')
            .select('*')
            .order('id', { ascending: true });
        
        if (errorAnimales) throw errorAnimales;
        
        // Para cada animal, cargar sus detalles específicos
        const animalesCompletos = await Promise.all(
            animales.map(async (animal) => {
                let detalles = {};
                
                try {
                    switch (animal.tipo) {
                        case 'Vaca':
                            const { data: vaca } = await supabaseClient
                                .from('vacas')
                                .select('*')
                                .eq('id', animal.id)
                                .single();
                            detalles = vaca || {};
                            break;
                            
                        case 'Toro':
                            const { data: toro } = await supabaseClient
                                .from('toros')
                                .select('*')
                                .eq('id', animal.id)
                                .single();
                            detalles = toro || {};
                            break;
                            
                        case 'Ternero':
                            const { data: ternero } = await supabaseClient
                                .from('terneros')
                                .select('*')
                                .eq('id', animal.id)
                                .single();
                            detalles = ternero || {};
                            break;
                    }
                } catch (error) {
                    // Si hay error al cargar detalles específicos, usar datos básicos
                    console.warn(`Error cargando detalles para animal ${animal.id}:`, error);
                }
                
                return {
                    ...animal,
                    ...detalles,
                    fecha_registro: animal.created_at ? 
                        new Date(animal.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        }) : 'No registrada'
                };
            })
        );
        
        animalesCargados = animalesCompletos;
        animalesFiltrados = [...animalesCompletos];
        
        actualizarEstadisticasRapidas();
        renderizarTabla();
        
    } catch (error) {
        console.error('Error cargando animales:', error);
        
        // Mostrar mensaje más amigable
        document.getElementById('animals-table-body').innerHTML = `
            <tr>
                <td colspan="8" class="no-data">
                    <i class="fas fa-exclamation-triangle"></i> Error cargando datos: ${error.message}
                </td>
            </tr>
        `;
        
        // Resetear arrays
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
    
    // Aplicar filtros
    let resultados = animalesCargados.filter(animal => {
        // Filtro por búsqueda
        const coincideBusqueda = 
            animal.id.toString().includes(busqueda) ||
            (animal.nombre && animal.nombre.toLowerCase().includes(busqueda)) ||
            (animal.raza && animal.raza.toLowerCase().includes(busqueda));
        
        // Filtro por tipo
        const coincideTipo = tipoFiltro === 'all' || animal.tipo === tipoFiltro;
        
        return coincideBusqueda && coincideTipo;
    });
    
    // Aplicar orden
    resultados.sort((a, b) => {
        switch (orden) {
            case 'id':
                return a.id - b.id;
            case 'id-desc':
                return b.id - a.id;
            case 'nombre':
                return (a.nombre || '').localeCompare(b.nombre || '');
            case 'fecha':
                return new Date(b.created_at) - new Date(a.created_at);
            default:
                return 0;
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
    
    if (!tbody) return; // Salir si el elemento no existe
    
    if (animalesFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">
                    <i class="fas fa-search"></i> No se encontraron animales
                </td>
            </tr>
        `;
        actualizarContador(0);
        actualizarPaginacion();
        return;
    }
    
    // Calcular índices para paginación
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const animalesPagina = animalesFiltrados.slice(inicio, fin);
    
    // Generar filas de la tabla
    const filasHTML = animalesPagina.map(animal => {
        const tipoClass = animal.tipo.toLowerCase();
        const infoEspecifica = obtenerInfoEspecifica(animal);
        
        // Escapar caracteres especiales en el nombre
        const nombreSeguro = (animal.nombre || animal.tipo).replace(/'/g, "\\'").replace(/"/g, '\\"');
        
        return `
            <tr>
                <td><strong>#${animal.id}</strong></td>
                <td>
                    <span class="animal-type ${tipoClass}">
                        <i class="fas fa-${getAnimalIcon(animal.tipo)}"></i>
                        ${animal.tipo}
                    </span>
                </td>
                <td>${animal.nombre || 'Sin nombre'}</td>
                <td>${animal.raza || 'No especificada'}</td>
                <td>${animal.edad_aproximada ? animal.edad_aproximada + ' años' : 'N/A'}</td>
                <td>${infoEspecifica}</td>
                <td>${animal.fecha_registro || 'N/A'}</td>
                <td>
                    <div class="animal-actions">
                        <button class="btn-action btn-view" onclick="verDetalles(${animal.id})" 
                                title="Ver detalles">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                        <button class="btn-action btn-edit" onclick="editarAnimal(${animal.id})" 
                                title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="eliminarAnimal(${animal.id}, '${nombreSeguro}')" 
                                title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
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
        case 'Vaca':
            return animal.total_partos ? `${animal.total_partos} partos` : 'N/A';
        case 'Toro':
            return animal.edad_aproximada ? `${animal.edad_aproximada} años` : 'N/A';
        case 'Ternero':
            return animal.genero || 'N/A';
        default:
            return 'N/A';
    }
}

function actualizarContador(total) {
    const inicio = (paginaActual - 1) * itemsPorPagina + 1;
    const fin = Math.min(paginaActual * itemsPorPagina, total);
    
    document.getElementById('table-count').textContent = 
        `Mostrando ${inicio}-${fin} de ${total} animales`;
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
        // Buscar el animal en los datos cargados
        const animal = animalesCargados.find(a => a.id === id);
        
        if (!animal) {
            throw new Error('Animal no encontrado en la lista local');
        }
        
        // Verificar si aún existe en la base de datos
        try {
            const { data: existe } = await supabaseClient
                .from('animales')
                .select('id')
                .eq('id', id)
                .single();
                
            if (!existe) {
                throw new Error('El animal ya no existe en la base de datos');
            }
        } catch (error) {
            // Si no existe, actualizar la lista local
            animalesCargados = animalesCargados.filter(a => a.id !== id);
            animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
            renderizarTabla();
            actualizarEstadisticasRapidas();
            
            throw new Error('El animal ya no existe. La lista ha sido actualizada.');
        }
        
        // Formatear los detalles para el modal
        const detallesHTML = crearHTMLDetalles(animal);
        
        document.getElementById('modal-title').textContent = 
            `Detalles: ${animal.nombre || animal.tipo} #${animal.id}`;
        document.getElementById('modal-body').innerHTML = detallesHTML;
        
        // Actualizar botón de editar
        document.getElementById('btn-editar').onclick = () => editarAnimal(id);
        
        // Mostrar modal
        document.getElementById('animal-detail-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error cargando detalles:', error);
        
        if (error.message.includes('ya no existe')) {
            mostrarConfirmacion(error.message);
        } else {
            mostrarError(
                'Error de Detalles',
                'No se pudieron cargar los detalles del animal',
                error.message
            );
        }
    } finally {
        ocultarLoading();
    }
}

function crearHTMLDetalles(animal) {
    return `
        <div class="animal-details">
            <div class="detail-row">
                <span class="detail-label">ID:</span>
                <span class="detail-value"><strong>#${animal.id}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tipo:</span>
                <span class="detail-value">
                    <span class="animal-type ${animal.tipo.toLowerCase()}">
                        <i class="fas fa-${getAnimalIcon(animal.tipo)}"></i>
                        ${animal.tipo}
                    </span>
                </span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Nombre:</span>
                <span class="detail-value">${animal.nombre || 'Sin nombre'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Raza:</span>
                <span class="detail-value">${animal.raza || 'No especificada'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Edad:</span>
                <span class="detail-value">${animal.edad_aproximada ? animal.edad_aproximada + ' años' : 'N/A'}</span>
            </div>
            ${animal.tipo === 'Vaca' ? `
            <div class="detail-row">
                <span class="detail-label">Total Partos:</span>
                <span class="detail-value">${animal.total_partos || 'N/A'}</span>
            </div>
            ` : ''}
            ${animal.tipo === 'Ternero' ? `
            <div class="detail-row">
                <span class="detail-label">Género:</span>
                <span class="detail-value">${animal.genero || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Fecha Nacimiento:</span>
                <span class="detail-value">${animal.fecha_nacimiento || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Padre (ID):</span>
                <span class="detail-value">${animal.padre ? '#' + animal.padre : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Madre (ID):</span>
                <span class="detail-value">${animal.madre ? '#' + animal.madre : 'N/A'}</span>
            </div>
            ` : ''}
            ${animal.observaciones ? `
            <div class="detail-row">
                <span class="detail-label">Observaciones:</span>
                <span class="detail-value">${animal.observaciones}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Fecha Registro:</span>
                <span class="detail-value">${animal.fecha_registro || 'N/A'}</span>
            </div>
        </div>
    `;
}

function cerrarModal() {
    document.getElementById('animal-detail-modal').classList.add('hidden');
    // Limpiar el contenido del modal
    document.getElementById('modal-body').innerHTML = '';
}
// ================= FUNCIONES COMPLETAS DE EDICIÓN Y ELIMINACIÓN =================
let animalAEliminar = null;
let animalEditando = null;
let modoEdicion = false;

async function eliminarAnimal(id, nombre) {
    // Escapar comillas en el nombre para evitar problemas en el onclick
    const nombreEscapado = nombre.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    mostrarAdvertencia(
        'Confirmar Eliminación',
        `¿Estás seguro de eliminar al animal "${nombreEscapado}" (ID: ${id})?`,
        'Esta acción no se puede deshacer. Todos los datos del animal serán eliminados permanentemente.',
        async () => {
            try {
                // Cerrar el modal de advertencia inmediatamente
                cerrarAdvertencia();
                
                mostrarLoading('Eliminando animal...');
                
                // Obtener el tipo del animal desde la base de datos
                const { data: animal, error: errorAnimal } = await supabaseClient
                    .from('animales')
                    .select('tipo')
                    .eq('id', id)
                    .single();
                
                if (errorAnimal) {
                    // Si el animal ya no existe, limpiar y salir
                    if (errorAnimal.code === 'PGRST116') {
                        ocultarLoading();
                        
                        // Actualizar la lista para reflejar que ya no está
                        animalesCargados = animalesCargados.filter(a => a.id !== id);
                        animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                        renderizarTabla();
                        actualizarEstadisticasRapidas();
                        
                        mostrarConfirmacion(`El animal ya había sido eliminado. Lista actualizada.`);
                        return;
                    }
                    throw errorAnimal;
                }
                
                // Verificar si el animal tiene relaciones (solo para terneros)
                if (animal.tipo === 'Ternero') {
                    // Verificar si este ternero es padre o madre de otros terneros
                    const { data: ternerosComoPadre } = await supabaseClient
                        .from('terneros')
                        .select('id')
                        .eq('padre', id);
                    
                    const { data: ternerosComoMadre } = await supabaseClient
                        .from('terneros')
                        .select('id')
                        .eq('madre', id);
                    
                    if (ternerosComoPadre && ternerosComoPadre.length > 0) {
                        throw new Error('No se puede eliminar este animal porque es padre de otros terneros');
                    }
                    
                    if (ternerosComoMadre && ternerosComoMadre.length > 0) {
                        throw new Error('No se puede eliminar este animal porque es madre de otros terneros');
                    }
                }
                
                // Verificar si es vaca con terneros
                if (animal.tipo === 'Vaca') {
                    const { data: ternerosDeVaca } = await supabaseClient
                        .from('terneros')
                        .select('id')
                        .eq('madre', id);
                    
                    if (ternerosDeVaca && ternerosDeVaca.length > 0) {
                        throw new Error('No se puede eliminar esta vaca porque tiene terneros registrados');
                    }
                }
                
                // Verificar si es toro con terneros
                if (animal.tipo === 'Toro') {
                    const { data: ternerosDeToro } = await supabaseClient
                        .from('terneros')
                        .select('id')
                        .eq('padre', id);
                    
                    if (ternerosDeToro && ternerosDeToro.length > 0) {
                        throw new Error('No se puede eliminar este toro porque es padre de otros terneros');
                    }
                }
                
                // Eliminar de la tabla específica primero
                let errorEspecifico = null;
                
                switch (animal.tipo) {
                    case 'Vaca':
                        const { error: errorVaca } = await supabaseClient
                            .from('vacas')
                            .delete()
                            .eq('id', id);
                        errorEspecifico = errorVaca;
                        break;
                        
                    case 'Toro':
                        const { error: errorToro } = await supabaseClient
                            .from('toros')
                            .delete()
                            .eq('id', id);
                        errorEspecifico = errorToro;
                        break;
                        
                    case 'Ternero':
                        const { error: errorTernero } = await supabaseClient
                            .from('terneros')
                            .delete()
                            .eq('id', id);
                        errorEspecifico = errorTernero;
                        break;
                }
                
                if (errorEspecifico && errorEspecifico.code !== 'PGRST116') {
                    throw errorEspecifico;
                }
                
                // Eliminar de la tabla general
                const { error: errorGeneral } = await supabaseClient
                    .from('animales')
                    .delete()
                    .eq('id', id);
                
                if (errorGeneral && errorGeneral.code !== 'PGRST116') {
                    throw errorGeneral;
                }
                
                // Actualizar la lista en memoria
                animalesCargados = animalesCargados.filter(a => a.id !== id);
                animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                
                ocultarLoading();
                
                // Mostrar confirmación de éxito
                mostrarConfirmacion(`Animal "${nombreEscapado}" eliminado correctamente.`);
                
                // Actualizar la tabla
                renderizarTabla();
                actualizarEstadisticasRapidas();
                
            } catch (error) {
                ocultarLoading();
                console.error('Error eliminando animal:', error);
                
                if (error.message.includes('No se puede eliminar')) {
                    mostrarError(
                        'No se puede eliminar',
                        error.message,
                        'Este animal tiene relaciones con otros registros. Elimina primero los animales relacionados.'
                    );
                } else if (error.code === 'PGRST116') {
                    // El animal ya no existe
                    animalesCargados = animalesCargados.filter(a => a.id !== id);
                    animalesFiltrados = animalesFiltrados.filter(a => a.id !== id);
                    renderizarTabla();
                    actualizarEstadisticasRapidas();
                    
                    mostrarConfirmacion(`El animal ya había sido eliminado. Lista actualizada.`);
                } else {
                    mostrarError(
                        'Error al Eliminar',
                        'No se pudo eliminar el animal',
                        error.message
                    );
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
        // Cerrar cualquier modal abierto
        cerrarModal();
        cerrarTodosLosModales();
        
        console.log('Iniciando edición para ID:', id);
        
        // Obtener datos básicos del animal
        const { data: animalBasico, error: errorBasico } = await supabaseClient
            .from('animales')
            .select('*')
            .eq('id', id)
            .single();
        
        if (errorBasico) {
            console.error('Error obteniendo datos básicos:', errorBasico);
            throw new Error('Animal no encontrado');
        }
        
        console.log('Animal básico encontrado:', animalBasico);
        
        // Obtener datos específicos según el tipo
        let detalles = {};
        const tipo = animalBasico.tipo.toLowerCase();
        
        switch (animalBasico.tipo) {
            case 'Vaca':
                const { data: vaca } = await supabaseClient
                    .from('vacas')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (vaca) detalles = vaca;
                break;
                
            case 'Toro':
                const { data: toro } = await supabaseClient
                    .from('toros')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (toro) detalles = toro;
                break;
                
            case 'Ternero':
                const { data: ternero } = await supabaseClient
                    .from('terneros')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (ternero) detalles = ternero;
                break;
        }
        
        // Combinar datos
        const animalCompleto = { ...animalBasico, ...detalles };
        console.log('Datos completos del animal:', animalCompleto);
        
        // Cambiar a la pestaña de registro
        cambiarTab('registro');
        
        // Esperar a que la pestaña se cargue
        setTimeout(() => {
            mostrarFormularioEdicion(tipo, animalCompleto);
        }, 100);
        
    } catch (error) {
        console.error('Error en editarAnimal:', error);
        mostrarError(
            'Error al editar',
            'No se pudo cargar el animal para edición',
            error.message
        );
    }
}

function mostrarFormularioEdicion(tipo, datos) {
    console.log('Mostrando formulario de edición para:', tipo, datos);
    
    // Primero ocultar todos los formularios
    document.querySelectorAll('.animal-form').forEach(form => {
        form.classList.add('hidden');
    });
    
    // Mostrar el formulario correspondiente
    const formulario = document.getElementById(`form-${tipo}`);
    if (!formulario) {
        console.error('Formulario no encontrado:', `form-${tipo}`);
        mostrarError('Error', `No se encontró el formulario para ${tipo}`);
        return;
    }
    
    formulario.classList.remove('hidden');
    
    // Actualizar títulos
    document.getElementById('form-title').textContent = `Editando ${tipo} #${datos.id}`;
    document.getElementById('form-subtitle').textContent = 'Modifica los campos que necesites';
    
    // Destacar la tarjeta correspondiente
    document.querySelectorAll('.animal-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.animal === tipo) {
            card.classList.add('selected');
        }
    });
    
    // Rellenar campos según el tipo
    setTimeout(() => {
        rellenarCamposFormulario(tipo, datos);
        
        // Configurar botones para edición
        configurarBotonesEdicion(tipo, datos.id);
        
        // Hacer scroll al formulario
        formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Agregar indicador visual de edición
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

// ================= FUNCIÓN PARA CONFIGURAR BOTONES DE EDICIÓN =================

function configurarBotonesEdicion(tipo, id) {
    console.log('Configurando botones para edición de:', tipo, id);
    
    // Remover botón cancelar edición si existe
    const btnCancelarExistente = document.getElementById('btn-cancelar-edicion');
    if (btnCancelarExistente) {
        btnCancelarExistente.remove();
    }
    
    // Encontrar el botón principal del formulario
    const formulario = document.getElementById(`form-${tipo}`);
    const btnPrincipal = formulario.querySelector('.btn-primary');
    const formActions = formulario.querySelector('.form-actions');
    
    if (!btnPrincipal || !formActions) {
        console.error('No se encontraron botones en el formulario');
        return;
    }
    
    // Cambiar texto y función del botón principal
    btnPrincipal.innerHTML = `<i class="fas fa-save"></i> Actualizar ${capitalizeFirstLetter(tipo)}`;
    
    switch (tipo) {
        case 'vaca':
            btnPrincipal.onclick = () => actualizarVaca(id);
            break;
        case 'toro':
            btnPrincipal.onclick = () => actualizarToro(id);
            break;
        case 'ternero':
            btnPrincipal.onclick = () => actualizarTernero(id);
            break;
    }
    
    // Crear botón de cancelar edición
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.id = 'btn-cancelar-edicion';
    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
    btnCancelar.onclick = cancelarEdicion;
    
    // Insertar botón cancelar antes del botón principal
    formActions.insertBefore(btnCancelar, btnPrincipal);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// ================= FUNCIÓN PARA LIMPIAR TODOS LOS FORMULARIOS =================

function limpiarTodosLosFormularios() {
    console.log('Limpiando todos los formularios');
    
    // Habilitar campos ID
    document.getElementById('v_id').disabled = false;
    document.getElementById('t_id').disabled = false;
    document.getElementById('te_id').disabled = false;
    
    // Limpiar valores
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

// ================= FUNCIONES ESPECÍFICAS PARA RELLENAR FORMULARIOS =================

function rellenarFormularioVaca(datos) {
    console.log('Rellenando formulario de vaca con datos:', datos);
    
    document.getElementById('v_id').value = datos.id;
    document.getElementById('v_id').disabled = true;
    document.getElementById('v_raza').value = datos.raza || '';
    document.getElementById('v_nombre').value = datos.nombre || '';
    document.getElementById('v_edad').value = datos.edad_aproximada || '';
    document.getElementById('v_partos').value = datos.total_partos || '';
    document.getElementById('v_obs').value = datos.observaciones || '';
    
    // Cambiar texto del botón de guardar
    const btnGuardarVaca = document.querySelector('#form-vaca .btn-primary');
    if (btnGuardarVaca) {
        btnGuardarVaca.innerHTML = '<i class="fas fa-save"></i> Actualizar Vaca';
        btnGuardarVaca.onclick = () => actualizarVaca(datos.id);
    }
    
    // Agregar botón de cancelar edición
    agregarBotonCancelarEdicion('vaca');
}

function rellenarFormularioToro(datos) {
    console.log('Rellenando formulario de toro con datos:', datos);
    
    document.getElementById('t_id').value = datos.id;
    document.getElementById('t_id').disabled = true;
    document.getElementById('t_raza').value = datos.raza || '';
    document.getElementById('t_nombre').value = datos.nombre || '';
    document.getElementById('t_edad').value = datos.edad_aproximada || '';
    
    // Cambiar texto del botón de guardar
    const btnGuardarToro = document.querySelector('#form-toro .btn-primary');
    if (btnGuardarToro) {
        btnGuardarToro.innerHTML = '<i class="fas fa-save"></i> Actualizar Toro';
        btnGuardarToro.onclick = () => actualizarToro(datos.id);
    }
    
    // Agregar botón de cancelar edición
    agregarBotonCancelarEdicion('toro');
}

function rellenarFormularioTernero(datos) {
    console.log('Rellenando formulario de ternero con datos:', datos);
    
    document.getElementById('te_id').value = datos.id;
    document.getElementById('te_id').disabled = true;
    document.getElementById('te_raza').value = datos.raza || '';
    document.getElementById('te_nombre').value = datos.nombre || '';
    document.getElementById('te_genero').value = datos.genero || 'Macho';
    document.getElementById('te_fecha').value = datos.fecha_nacimiento || '';
    document.getElementById('te_padre').value = datos.padre || '';
    document.getElementById('te_madre').value = datos.madre || '';
    
    // Cambiar texto del botón de guardar
    const btnGuardarTernero = document.querySelector('#form-ternero .btn-primary');
    if (btnGuardarTernero) {
        btnGuardarTernero.innerHTML = '<i class="fas fa-save"></i> Actualizar Ternero';
        btnGuardarTernero.onclick = () => actualizarTernero(datos.id);
    }
    
    // Agregar botón de cancelar edición
    agregarBotonCancelarEdicion('ternero');
}

function agregarBotonCancelarEdicion(tipo) {
    const formActions = document.querySelector(`#form-${tipo} .form-actions`);
    if (!formActions) return;
    
    // Eliminar botón de cancelar existente si hay
    const btnCancelarExistente = formActions.querySelector('#btn-cancelar-edicion');
    if (btnCancelarExistente) {
        btnCancelarExistente.remove();
    }
    
    // Crear nuevo botón de cancelar
    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.id = 'btn-cancelar-edicion';
    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
    btnCancelar.onclick = cancelarEdicion;
    
    // Insertar antes del botón principal
    const btnPrincipal = formActions.querySelector('.btn-primary');
    if (btnPrincipal) {
        formActions.insertBefore(btnCancelar, btnPrincipal);
    } else {
        formActions.appendChild(btnCancelar);
    }
}

// ================= MEJORAR FUNCIÓN mostrarFormularioParaEdicion =================

function mostrarFormulario(tipo) {
    console.log('Mostrar formulario llamado para tipo:', tipo, 'Modo edición:', modoEdicion);
    
    // Si estamos en modo edición, verificar si estamos editando el mismo tipo
    if (modoEdicion) {
        const tipoEditando = animalEditando?.tipo?.toLowerCase();
        if (tipoEditando && tipoEditando !== tipo) {
            const confirmar = window.confirm('¿Desea cancelar la edición actual para registrar un nuevo animal? Los cambios no guardados se perderán.');
            if (!confirmar) {
                return;
            }
            cancelarEdicion();
        } else {
            // Ya estamos editando este tipo, no hacer nada
            return;
        }
    }
    
    // Proceder normalmente si no estamos editando
    limpiarErrores();
    ocultarFormularios();
    tipoFormularioActual = tipo;
    
    const form = document.getElementById(`form-${tipo}`);
    const title = document.getElementById('form-title');
    const subtitle = document.getElementById('form-subtitle');
    
    if (form) {
        form.classList.remove('hidden');
        
        const nombres = {
            'vaca': 'Vaca',
            'toro': 'Toro',
            'ternero': 'Ternero/a'
        };
        
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


function mostrarFormularioParaEdicion(tipo, datos) {
    // Mostrar el formulario correspondiente
    mostrarFormulario(tipo);
    
    // Rellenar los campos con los datos del animal
    setTimeout(() => {
        switch (tipo) {
            case 'vaca':
                document.getElementById('v_id').value = datos.id;
                document.getElementById('v_id').disabled = true; // ID no se puede editar
                document.getElementById('v_raza').value = datos.raza || '';
                document.getElementById('v_nombre').value = datos.nombre || '';
                document.getElementById('v_edad').value = datos.edad_aproximada || '';
                document.getElementById('v_partos').value = datos.total_partos || '';
                document.getElementById('v_obs').value = datos.observaciones || '';
                
                // Cambiar texto del botón
                const btnGuardarVaca = document.querySelector('#form-vaca .btn-primary');
                if (btnGuardarVaca) {
                    btnGuardarVaca.innerHTML = '<i class="fas fa-save"></i> Actualizar Vaca';
                    btnGuardarVaca.onclick = () => actualizarVaca(datos.id);
                }
                
                // Agregar botón de cancelar edición
                const formActionsVaca = document.querySelector('#form-vaca .form-actions');
                if (!formActionsVaca.querySelector('#btn-cancelar-edicion')) {
                    const btnCancelar = document.createElement('button');
                    btnCancelar.type = 'button';
                    btnCancelar.className = 'btn-secondary';
                    btnCancelar.id = 'btn-cancelar-edicion';
                    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
                    btnCancelar.onclick = cancelarEdicion;
                    formActionsVaca.appendChild(btnCancelar);
                }
                break;
                
            case 'toro':
                document.getElementById('t_id').value = datos.id;
                document.getElementById('t_id').disabled = true;
                document.getElementById('t_raza').value = datos.raza || '';
                document.getElementById('t_nombre').value = datos.nombre || '';
                document.getElementById('t_edad').value = datos.edad_aproximada || '';
                
                const btnGuardarToro = document.querySelector('#form-toro .btn-primary');
                if (btnGuardarToro) {
                    btnGuardarToro.innerHTML = '<i class="fas fa-save"></i> Actualizar Toro';
                    btnGuardarToro.onclick = () => actualizarToro(datos.id);
                }
                
                const formActionsToro = document.querySelector('#form-toro .form-actions');
                if (!formActionsToro.querySelector('#btn-cancelar-edicion')) {
                    const btnCancelar = document.createElement('button');
                    btnCancelar.type = 'button';
                    btnCancelar.className = 'btn-secondary';
                    btnCancelar.id = 'btn-cancelar-edicion';
                    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
                    btnCancelar.onclick = cancelarEdicion;
                    formActionsToro.appendChild(btnCancelar);
                }
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
                
                const btnGuardarTernero = document.querySelector('#form-ternero .btn-primary');
                if (btnGuardarTernero) {
                    btnGuardarTernero.innerHTML = '<i class="fas fa-save"></i> Actualizar Ternero';
                    btnGuardarTernero.onclick = () => actualizarTernero(datos.id);
                }
                
                const formActionsTernero = document.querySelector('#form-ternero .form-actions');
                if (!formActionsTernero.querySelector('#btn-cancelar-edicion')) {
                    const btnCancelar = document.createElement('button');
                    btnCancelar.type = 'button';
                    btnCancelar.className = 'btn-secondary';
                    btnCancelar.id = 'btn-cancelar-edicion';
                    btnCancelar.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
                    btnCancelar.onclick = cancelarEdicion;
                    formActionsTernero.appendChild(btnCancelar);
                }
                break;
        }
        
        // Actualizar título del formulario
        document.getElementById('form-title').textContent = `Editando ${datos.tipo.toLowerCase()} #${datos.id}`;
        document.getElementById('form-subtitle').textContent = 'Modifica los campos que necesites';
        
    }, 100);
}

function cancelarEdicion() {
    console.log('Cancelando edición');
    
    // Remover clase de edición de todos los formularios
    document.querySelectorAll('.animal-form').forEach(form => {
        form.classList.remove('editing');
    });
    
    // Limpiar todos los formularios
    limpiarTodosLosFormularios();
    
    // Restaurar botones originales
    restaurarBotonesOriginales();
    
    // Ocultar formularios y mostrar selección
    ocultarFormularios();
    
    // Cambiar a pestaña de consulta
    setTimeout(() => {
        cambiarTab('consulta');
    }, 100);
}

function restaurarBotonesOriginales() {
    console.log('Restaurando botones originales');
    
    // Restaurar botón de vaca
    const btnGuardarVaca = document.querySelector('#form-vaca .btn-primary');
    if (btnGuardarVaca) {
        btnGuardarVaca.innerHTML = '<i class="fas fa-save"></i> Guardar Vaca';
        btnGuardarVaca.onclick = guardarVaca;
    }
    
    // Restaurar botón de toro
    const btnGuardarToro = document.querySelector('#form-toro .btn-primary');
    if (btnGuardarToro) {
        btnGuardarToro.innerHTML = '<i class="fas fa-save"></i> Guardar Toro';
        btnGuardarToro.onclick = guardarToro;
    }
    
    // Restaurar botón de ternero
    const btnGuardarTernero = document.querySelector('#form-ternero .btn-primary');
    if (btnGuardarTernero) {
        btnGuardarTernero.innerHTML = '<i class="fas fa-save"></i> Guardar Ternero';
        btnGuardarTernero.onclick = guardarTernero;
    }
    
    // Eliminar botones de cancelar edición
    document.querySelectorAll('#btn-cancelar-edicion').forEach(btn => {
        btn.remove();
    });
}

// ================= ESTADÍSTICAS =================

async function cargarEstadisticas() {
    mostrarLoading('Cargando estadísticas...');
    
    try {
        // Esperar a que se carguen los animales si no están cargados
        if (animalesCargados.length === 0) {
            await cargarAnimales();
        }
        
        // Ocultar loading y mostrar estadísticas
        document.getElementById('stats-loading').style.display = 'none';
        document.getElementById('stats-grid').style.display = 'block';
        
        // Generar estadísticas
        generarEstadisticas();
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        document.getElementById('stats-loading').innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error cargando estadísticas</p>
        `;
    } finally {
        ocultarLoading();
    }
}

function generarEstadisticas() {
    // Datos para estadísticas
    const tipos = ['Vaca', 'Toro', 'Ternero'];
    const conteoTipos = tipos.map(tipo => 
        animalesCargados.filter(a => a.tipo === tipo).length
    );
    
    // Contar razas
    const razasCount = {};
    animalesCargados.forEach(animal => {
        if (animal.raza) {
            razasCount[animal.raza] = (razasCount[animal.raza] || 0) + 1;
        }
    });
    
    // Ordenar razas por frecuencia
    const razasTop = Object.entries(razasCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    // Calcular estadísticas mensuales
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();
    
    const registrosEsteMes = animalesCargados.filter(animal => {
        if (!animal.created_at) return false;
        const fechaRegistro = new Date(animal.created_at);
        return fechaRegistro.getMonth() === mesActual && 
               fechaRegistro.getFullYear() === añoActual;
    }).length;
    
    const ternerosEsteMes = animalesCargados.filter(animal => 
        animal.tipo === 'Ternero' && 
        animal.created_at && 
        new Date(animal.created_at).getMonth() === mesActual
    ).length;
    
    // Calcular promedio de edad
    const animalesConEdad = animalesCargados.filter(a => a.edad_aproximada);
    const promedioEdad = animalesConEdad.length > 0 ?
        animalesConEdad.reduce((sum, a) => sum + a.edad_aproximada, 0) / animalesConEdad.length : 0;
    
    // Encontrar vaca más vieja
    const vacas = animalesCargados.filter(a => a.tipo === 'Vaca');
    const vacaMasVieja = vacas.reduce((vieja, actual) => 
        (actual.edad_aproximada || 0) > (vieja.edad_aproximada || 0) ? actual : vieja, {});
    
    // Actualizar estadísticas en la interfaz
    document.getElementById('month-registrations').textContent = registrosEsteMes;
    document.getElementById('month-calves').textContent = ternerosEsteMes;
    document.getElementById('avg-age').textContent = promedioEdad.toFixed(1) + ' años';
    document.getElementById('oldest-cow').textContent = 
        vacaMasVieja.nombre ? `${vacaMasVieja.nombre} (${vacaMasVieja.edad_aproximada} años)` : 'N/A';
    
    // Buscar toro más utilizado (con más terneros)
    const torosUsados = {};
    animalesCargados
        .filter(a => a.tipo === 'Ternero' && a.padre)
        .forEach(ternero => {
            torosUsados[ternero.padre] = (torosUsados[ternero.padre] || 0) + 1;
        });
    
    const toroPrincipalId = Object.keys(torosUsados).reduce((a, b) => 
        torosUsados[a] > torosUsados[b] ? a : b, null
    );
    
    const toroPrincipal = animalesCargados.find(a => a.id === parseInt(toroPrincipalId));
    document.getElementById('main-bull').textContent = 
        toroPrincipal ? `${toroPrincipal.nombre || 'Toro'} #${toroPrincipal.id}` : 'N/A';
    
    // Último registro
    const ultimoRegistro = animalesCargados
        .filter(a => a.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    document.getElementById('last-registration').textContent = 
        ultimoRegistro ? `${ultimoRegistro.tipo} #${ultimoRegistro.id}` : 'N/A';
    
    // Crear gráficos
    crearGraficos(conteoTipos, razasTop);
}

function crearGraficos(conteoTipos, razasTop) {
    // Destruir gráficos anteriores si existen
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    charts = {};
    
    // Colores para gráficos
    const colores = {
        Vaca: '#2e7d32',
        Toro: '#ff9800',
        Ternero: '#2196f3'
    };
    
    // Gráfico de distribución por tipo
    const ctxTipo = document.getElementById('chart-type-distribution').getContext('2d');
    charts.tipo = new Chart(ctxTipo, {
        type: 'pie',
        data: {
            labels: ['Vacas', 'Toros', 'Terneros'],
            datasets: [{
                data: conteoTipos,
                backgroundColor: [
                    colores.Vaca,
                    colores.Toro,
                    colores.Ternero
                ],
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
    
    // Gráfico de razas más comunes
    const ctxRazas = document.getElementById('chart-breeds').getContext('2d');
    charts.razas = new Chart(ctxRazas, {
        type: 'bar',
        data: {
            labels: razasTop.map(r => r[0]),
            datasets: [{
                label: 'Cantidad',
                data: razasTop.map(r => r[1]),
                backgroundColor: razasTop.map((_, i) => 
                    `hsl(${i * 60}, 70%, 60%)`
                ),
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
    
    // Gráfico de evolución de registros (simulado)
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

function exportarDatos() {
    if (animalesCargados.length === 0) {
        mostrarAdvertencia(
            'Sin Datos',
            'No hay animales registrados para exportar.',
            'Registra algunos animales primero para poder exportar los datos.'
        );
        return;
    }
    
    // Formatear datos para CSV
    const headers = ['ID', 'Tipo', 'Nombre', 'Raza', 'Edad', 'Género', 'Fecha Nacimiento', 'Padre', 'Madre', 'Partos', 'Observaciones', 'Fecha Registro'];
    
    const csvData = animalesCargados.map(animal => [
        animal.id,
        animal.tipo,
        animal.nombre || '',
        animal.raza || '',
        animal.edad_aproximada || '',
        animal.genero || '',
        animal.fecha_nacimiento || '',
        animal.padre || '',
        animal.madre || '',
        animal.total_partos || '',
        animal.observaciones ? `"${animal.observaciones.replace(/"/g, '""')}"` : '',
        animal.fecha_registro || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
    ].join('\n');
    
    // Crear y descargar archivo
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

// ================= INICIALIZACIÓN =================

document.addEventListener('DOMContentLoaded', function() {
    // Establecer año actual en el footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Establecer fecha mínima para fecha de nacimiento
    const fechaInput = document.getElementById('te_fecha');
    if (fechaInput) {
        const today = new Date().toISOString().split('T')[0];
        fechaInput.max = today;
        fechaInput.min = '2000-01-01';
    }
    
    // Configurar validación en tiempo real
    configurarValidacionTiempoReal();
    
    // Cargar animales automáticamente si estamos en la pestaña de consulta
    if (document.getElementById('tab-consulta').classList.contains('active')) {
        cargarAnimales();
    }
});

// ================= FUNCIÓN PARA LIMPIAR TODOS LOS MODALES =================

function cerrarTodosLosModales() {
    document.getElementById('confirmation-message').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('warning-message').classList.add('hidden');
    document.getElementById('animal-detail-modal').classList.add('hidden');
    ocultarLoading();
}