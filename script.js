document.addEventListener('DOMContentLoaded', async function () {

    // Supabase setup
    let supabaseClient;
    async function initDB() {
        // Replace with your Supabase credentials
        const supabaseUrl = 'https://YOUR_SUPABASE_URL.supabase.co';
        const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    }

    async function dbGetAll(table) {
        const { data } = await supabaseClient.from(table).select('*');
        return data || [];
    }

    function dbPut(table, item) {
        supabaseClient.from(table).upsert(item);
    }

    function dbDelete(table, key) {
        supabaseClient.from(table).delete().eq('id', key);
    }

    await initDB();

    // Variables globales
    let inventory = await dbGetAll('inventory');
    let breedingRecords = await dbGetAll('breedingRecords');

    // Elementos del DOM
    const animalType = document.getElementById('animalType');
    const birthsField = document.getElementById('birthsField');
    const genderField = document.getElementById('genderField');
    const birthDateField = document.getElementById('birthDateField');
    const ageField = document.getElementById('ageField');
    const animalForm = document.getElementById('animalForm');
    const registerBreedingBtn = document.getElementById('registerBreeding');

    // Inicialización de pestañas
    const tabRegister = new bootstrap.Tab(document.getElementById('register-tab'));
    const tabQR = new bootstrap.Tab(document.getElementById('qr-tab'));
    const tabInventory = new bootstrap.Tab(document.getElementById('inventory-tab'));
    const tabBreeding = new bootstrap.Tab(document.getElementById('breeding-tab'));

    // Configuración inicial
    function initializeUI() {
        renderInventory();
        updateQRAnimalSelect();
        updateBreedingSelects();
        renderBreedingRecords();
    }

    // Evento para cambio de tipo de animal
    animalType.addEventListener('change', function () {
        if (this.value === 'vaca') {
            birthsField.classList.remove('d-none');
            document.getElementById('female').checked = true;
            genderField.classList.add('d-none');
            birthDateField.classList.add('d-none');
            ageField.classList.remove('d-none');
        } else if (this.value === 'toro') {
            birthsField.classList.add('d-none');
            document.getElementById('male').checked = true;
            genderField.classList.add('d-none');
            birthDateField.classList.add('d-none');
            ageField.classList.remove('d-none');
        } else {
            birthsField.classList.add('d-none');
            genderField.classList.remove('d-none');
            birthDateField.classList.remove('d-none');
            ageField.classList.add('d-none');
        }
    });

    // Registrar nuevo animal
    animalForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const type = animalType.value;
        const earTag = document.getElementById('earTag').value;
        const name = document.getElementById('name').value || 'Sin nombre';
        const breed = document.getElementById('breed').value;
        // Validar arete único
        if (!isEarTagUnique(earTag)) {
            Swal.fire({
                title: 'Arete duplicado',
                text: 'El número de arete ya existe en el sistema. Por favor ingrese un número único.',
                icon: 'error',
                confirmButtonColor: '#2c8a47'
            });
            return;
        }
        const gender = type === 'vaca' ? 'hembra' :
            type === 'toro' ? 'macho' :
                document.querySelector('input[name="gender"]:checked').value;
        const births = type === 'vaca' ? parseInt(document.getElementById('births').value) : 0;
        const notes = document.getElementById('notes').value;


        // Calcular edad/fecha de nacimiento
        let age, birthDate;
        if (type === 'ternero') {
            birthDate = document.getElementById('birthDate').value;
            const today = new Date();
            const birthDateObj = new Date(birthDate);
            age = today.getFullYear() - birthDateObj.getFullYear();
            const monthDiff = today.getMonth() - birthDateObj.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
                age--;
            }
        } else {
            age = parseInt(document.getElementById('age').value);
            birthDate = null;
        }

        // Crear objeto animal
        const animal = {
            id: Date.now(),
            type,
            earTag,
            name,
            age,
            birthDate,
            breed,
            gender,
            births,
            notes,
            registrationDate: new Date().toISOString()
        };

        // Guardar y actualizar
        inventory.push(animal);
        dbPut('inventory', animal);

        Swal.fire({
            title: '¡Registro exitoso!',
            html: `<strong>${name}</strong> (${earTag}) ha sido registrado correctamente.`,
            icon: 'success',
            confirmButtonColor: '#2c8a47',
            confirmButtonText: 'Aceptar'
        });

        animalForm.reset();
        initializeUI();
        tabInventory.show();
    });

    // Función para actualizar selects de reproducción
    function updateBreedingSelects() {
        const cowSelect = document.getElementById('pregnantCowSelect');
        const bullSelect = document.getElementById('breedingBullSelect');

        if (!cowSelect || !bullSelect) return;

        cowSelect.innerHTML = '<option value="">Seleccione una vaca...</option>';
        bullSelect.innerHTML = '<option value="">Seleccione un toro...</option>';

        // Filtrar vacas disponibles (no preñadas actualmente y con menos de 1 parto registrado)
        const availableCows = inventory.filter(animal => {
            return animal.type === 'vaca' &&
                !breedingRecords.some(r => r.cowId === animal.id && !r.birthRegistered);
        });

        availableCows.forEach(cow => {
            cowSelect.add(new Option(`${cow.earTag} - ${cow.name || 'Sin nombre'}`, cow.id));
        });

        inventory.filter(a => a.type === 'toro').forEach(bull => {
            bullSelect.add(new Option(`${bull.earTag} - ${bull.name || 'Sin nombre'}`, bull.id));
        });

        document.getElementById('breedingDate').onchange = function () {
            if (this.value) {
                const expectedDate = new Date(this.value);
                expectedDate.setDate(expectedDate.getDate() + 283);
                document.getElementById('expectedBirthDate').value = expectedDate.toISOString().split('T')[0];
            }
        };
    }

    // Registrar preñez
    registerBreedingBtn.onclick = function () {
        const cowId = parseInt(document.getElementById('pregnantCowSelect').value);
        const bullId = parseInt(document.getElementById('breedingBullSelect').value) || null;
        const breedingDate = document.getElementById('breedingDate').value;
        const expectedBirthDate = document.getElementById('expectedBirthDate').value;

        if (!cowId || !breedingDate) {
            Swal.fire({
                title: 'Datos incompletos',
                text: 'Debe seleccionar una vaca y la fecha de preñez',
                icon: 'error'
            });
            return;
        }

        const record = {
            id: Date.now(),
            cowId,
            bullId,
            breedingDate,
            expectedBirthDate,
            registeredDate: new Date().toISOString(),
            birthRegistered: false
        };

        breedingRecords.push(record);
        dbPut('breedingRecords', record);

        Swal.fire({
            title: '¡Registro exitoso!',
            text: 'La preñez ha sido registrada correctamente',
            icon: 'success'
        });

        // Limpiar formulario
        document.getElementById('pregnantCowSelect').value = '';
        document.getElementById('breedingBullSelect').value = '';
        document.getElementById('breedingDate').value = '';
        document.getElementById('expectedBirthDate').value = '';

        initializeUI();
    };

    // Funciones de renderizado (mantienen la misma implementación que en tu código original)
    function renderInventory() {
        const inventoryTable = document.getElementById('inventoryTable').querySelector('tbody');
        inventoryTable.innerHTML = '';

        if (inventory.length === 0) {
            inventoryTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="fas fa-cow fa-3x mb-3" style="color: #6c757d;"></i>
                        <h5 class="text-muted">No hay animales registrados</h5>
                        <p class="text-muted">Registra tu primer animal en la pestaña "Registro"</p>
                    </td>
                </tr>`;
            return;
        }

        inventory.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate))
            .forEach(animal => {
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${animal.earTag}</td>
                <td>${animal.type}</td>
                <td>${animal.name}</td>
                <td>${animal.age} años</td>
                <td>${animal.breed}</td>
                <td>
                    <button class="btn btn-sm btn-info view-btn" data-id="${animal.id}">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${animal.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>`;
                inventoryTable.appendChild(row);
            });

        // Agregar event listeners
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.onclick = () => viewAnimalDetails(parseInt(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => deleteAnimal(parseInt(btn.getAttribute('data-id')));
        });
    }

    function renderBreedingRecords() {
        const breedingTable = document.getElementById('breedingTable').querySelector('tbody');
        breedingTable.innerHTML = '';

        if (breedingRecords.length === 0) {
            breedingTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="fas fa-cow fa-2x mb-2" style="color: #6c757d;"></i>
                        <p class="text-muted">No hay registros de preñez</p>
                    </td>
                </tr>`;
            return;
        }

        breedingRecords.forEach(record => {
            let cow = inventory.find(a => a.id === record.cowId);
            let bull = record.bullId ? inventory.find(a => a.id === record.bullId) : null;

            const row = document.createElement('tr');

            if (record.birthRegistered) {
                row.innerHTML = `
                    <td>${cow ? cow.name : '<span class="text-danger">Vaca eliminada</span>'}</td>
                    <td>${cow ? cow.earTag : 'N/A'}</td>
                    <td>${new Date(record.breedingDate).toLocaleDateString()}</td>
                    <td>${new Date(record.expectedBirthDate).toLocaleDateString()}</td>
                    <td>${bull ? `${bull.earTag} - ${bull.name}` : (record.bullId ? '<span class="text-danger">Toro eliminado</span>' : 'Desconocido')}</td>
                    <td>
                        <span class="badge bg-success">
                            <i class="fas fa-check"></i> Parto: ${new Date(record.actualBirthDate).toLocaleDateString()}
                        </span>
                        <button class="btn btn-sm btn-danger delete-birth-btn ms-2" data-id="${record.id}">
                            <i class="fas fa-trash"></i> Eliminar Parto
                        </button>
                    </td>`;
            } else {
                row.innerHTML = `
                    <td>${cow ? cow.name : '<span class="text-danger">Vaca eliminada</span>'}</td>
                    <td>${cow ? cow.earTag : 'N/A'}</td>
                    <td>${new Date(record.breedingDate).toLocaleDateString()}</td>
                    <td>${new Date(record.expectedBirthDate).toLocaleDateString()}</td>
                    <td>${bull ? `${bull.earTag} - ${bull.name}` : (record.bullId ? '<span class="text-danger">Toro eliminado</span>' : 'Desconocido')}</td>
                    <td>
                        ${cow ?
                        `<button class="btn btn-sm btn-success birth-btn" data-id="${record.id}">
                                <i class="fas fa-baby"></i> Registrar Parto
                            </button>` :
                        '<span class="text-muted">No disponible</span>'
                    }
                        <button class="btn btn-sm btn-danger delete-breeding-btn" data-id="${record.id}">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </td>`;
            }

            breedingTable.appendChild(row);
        });

        // Configurar eventos
        document.querySelectorAll('.birth-btn').forEach(btn => {
            btn.onclick = () => registerBirth(parseInt(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.delete-breeding-btn').forEach(btn => {
            btn.onclick = () => deleteBreedingRecord(parseInt(btn.getAttribute('data-id')));
        });

        // Agregar evento para el nuevo botón de eliminar parto
        document.querySelectorAll('.delete-birth-btn').forEach(btn => {
            btn.onclick = () => deleteBirthRecord(parseInt(btn.getAttribute('data-id')));
        });
    }

    // Verificar si el arete es único
    function isEarTagUnique(earTag, excludeId = null) {
        return !inventory.some(animal => {
            // Verificar si el arete coincide y no es el animal que estamos excluyendo (para ediciones)
            return animal.earTag === earTag && (excludeId === null || animal.id !== excludeId);
        });
    }

    // Eliminar registro de parto
    function deleteBirthRecord(recordId) {
        const record = breedingRecords.find(r => r.id === recordId);
        if (!record || !record.birthRegistered) return;

        // Verificar que la vaca aún existe
        const cow = inventory.find(a => a.id === record.cowId);

        Swal.fire({
            title: '¿Eliminar registro de parto?',
            html: `Esta acción revertirá el parto registrado para:<br><br>
               <strong>Vaca:</strong> ${cow ? `${cow.earTag} - ${cow.name || 'Sin nombre'}` : 'Vaca eliminada'}<br>
               <strong>Fecha parto:</strong> ${new Date(record.actualBirthDate).toLocaleDateString()}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                // Revertir el conteo de partos si la vaca existe
                if (cow) {
                    cow.births = Math.max(0, (cow.births || 1) - 1);
                    dbPut('inventory', cow);
                }

                // Revertir el registro de parto
                record.birthRegistered = false;
                delete record.actualBirthDate;
                dbPut('breedingRecords', record);

                initializeUI();

                Swal.fire({
                    title: '¡Parto eliminado!',
                    text: 'El registro de parto ha sido eliminado correctamente',
                    icon: 'success',
                    timer: 2000
                });
            }
        });
    }

    // Funciones auxiliares (mantienen la misma implementación)
    function updateQRAnimalSelect() {
        const qrAnimalSelect = document.getElementById('qrAnimalSelect');
        qrAnimalSelect.innerHTML = '<option value="">Seleccione un animal...</option>';

        inventory.forEach(animal => {
            qrAnimalSelect.add(new Option(`${animal.earTag} - ${animal.name} (${animal.type})`, animal.id));
        });

        qrAnimalSelect.onchange = function () {
            const id = parseInt(this.value);
            if (!id) {
                document.getElementById('selectedAnimalInfo').innerHTML = '<p class="text-center text-muted">Seleccione un animal para ver sus detalles</p>';
                document.getElementById('qrPlaceholder').innerHTML = 'Código aparecerá aquí';
                document.getElementById('downloadQR').disabled = true;
                document.getElementById('qrAnimalDetails').innerHTML = '';
                return;
            }

            const animal = inventory.find(a => a.id === id);
            if (animal) {
                displayAnimalInfoForQR(animal);
                generateQRForAnimal(animal);
            }
        };
    }

    function registerBirth(recordId) {
        const record = breedingRecords.find(r => r.id === recordId);
        if (!record || record.birthRegistered) return;

        // Verificar que la vaca aún existe
        const cow = inventory.find(a => a.id === record.cowId);
        if (!cow) {
            Swal.fire({
                title: 'No se puede registrar',
                text: 'La vaca asociada a este registro ya no existe en el inventario',
                icon: 'error'
            });
            return;
        }

        Swal.fire({
            title: 'Registrar Parto',
            html: `¿Desea registrar el parto de esta vaca?<br><br>
               <strong>Vaca:</strong> ${cow.earTag} - ${cow.name || 'Sin nombre'}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar',
            input: 'date',
            inputLabel: 'Fecha real del parto',
            inputValue: new Date().toISOString().split('T')[0],
            inputValidator: (value) => {
                if (!value) return 'Debe ingresar una fecha válida';
                if (new Date(value) < new Date(record.breedingDate)) {
                    return 'La fecha de parto no puede ser anterior a la fecha de preñez';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Actualizar número de partos de la vaca
                cow.births = (cow.births || 0) + 1;
                dbPut('inventory', cow);

                // Marcar el registro como completado
                record.birthRegistered = true;
                record.actualBirthDate = result.value;
                dbPut('breedingRecords', record);

                initializeUI();

                Swal.fire({
                    title: '¡Parto registrado!',
                    html: `Parto registrado correctamente para:<br>
                       <strong>${cow.name || 'Vaca'} (${cow.earTag})</strong><br>
                       <strong>Fecha:</strong> ${new Date(result.value).toLocaleDateString()}`,
                    icon: 'success'
                });
            }
        });
    }


    function deleteBreedingRecord(recordId) {
        const record = breedingRecords.find(r => r.id === recordId);
        if (!record) return;

        // Si ya se registró el parto, no permitir eliminación
        if (record.birthRegistered) {
            Swal.fire({
                title: 'No se puede eliminar',
                text: 'Este registro ya tiene un parto registrado y no puede ser eliminado',
                icon: 'warning',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        Swal.fire({
            title: '¿Eliminar registro de preñez?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                breedingRecords = breedingRecords.filter(r => r.id !== recordId);
                dbDelete('breedingRecords', recordId);
                initializeUI();

                Swal.fire({
                    title: '¡Eliminado!',
                    text: 'El registro de preñez ha sido eliminado',
                    icon: 'success',
                    timer: 2000
                });
            }
        });
    }

    async function deleteAnimal(id) {
        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar registro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (isConfirmed) {
            // Verificar si el animal está en algún registro de parto
            const hasBreedingRecords = breedingRecords.some(record =>
                (record.cowId === id || record.bullId === id) && !record.birthRegistered
            );

            if (hasBreedingRecords) {
                Swal.fire({
                    title: 'No se puede eliminar',
                    html: `Este animal tiene registros de preñez activos.<br>
                       Primero debe eliminar los registros relacionados en Sala de Partos.`,
                    icon: 'warning',
                    confirmButtonColor: '#3085d6'
                });
                return;
            }

            // Eliminar solo del inventario (no tocar breedingRecords)
            inventory = inventory.filter(a => a.id !== id);
            dbDelete('inventory', id);

            initializeUI();

            // Limpiar QR si el animal mostrado fue eliminado
            const qrAnimalSelect = document.getElementById('qrAnimalSelect');
            if (parseInt(qrAnimalSelect.value) === id) {
                qrAnimalSelect.value = '';
                document.getElementById('selectedAnimalInfo').innerHTML = '<p class="text-center text-muted">Seleccione un animal para ver sus detalles</p>';
                document.getElementById('qrPlaceholder').innerHTML = 'Código aparecerá aquí';
                document.getElementById('downloadQR').disabled = true;
                document.getElementById('qrAnimalDetails').innerHTML = '';
            }

            Swal.fire({
                title: '¡Eliminado!',
                text: 'El animal ha sido eliminado del inventario',
                icon: 'success',
                timer: 2000
            });
        }
    }

    function displayAnimalInfoForQR(animal) {
        let html = `
        <h5>${animal.name}</h5>
        <p><strong>Tipo:</strong> ${animal.type}</p>
        <p><strong>Arete:</strong> ${animal.earTag}</p>
        <p><strong>Edad:</strong> ${animal.age} años</p>
        <p><strong>Raza:</strong> ${animal.breed}</p>
    `;

        if (animal.type === 'ternero' && animal.birthDate) {
            html += `<p><strong>Fecha nacimiento:</strong> ${new Date(animal.birthDate).toLocaleDateString()}</p>`;
        }

        if (animal.type === 'vaca') {
            html += `<p><strong>Partos:</strong> ${animal.births}</p>`;
        }

        document.getElementById('selectedAnimalInfo').innerHTML = html;
    }

    function generateQRForAnimal(animal) {
        // Crear texto para el QR
        const qrText = `
        Finca QR - Control de Ganado
        Tipo: ${animal.type.toUpperCase()}
        Arete: ${animal.earTag}
        Nombre: ${animal.name}
        Raza: ${animal.breed}
        Edad: ${animal.age} años
        Sexo: ${animal.gender}
        ${animal.type === 'vaca' ? 'Partos: ' + animal.births : ''}
        Registrado: ${new Date(animal.registrationDate).toLocaleDateString()}
                `.trim();

        // Generar QR
        const qr = qrcode(0, 'L');
        qr.addData(qrText);
        qr.make();

        // Limpiar contenedor
        const qrPlaceholder = document.getElementById('qrPlaceholder');
        qrPlaceholder.innerHTML = '';

        // Agregar imagen QR
        qrPlaceholder.innerHTML = qr.createImgTag(4);

        // Mostrar detalles para el QR
        document.getElementById('qrAnimalDetails').innerHTML = `
        <p><strong>Contenido del QR:</strong></p>
        <pre class="bg-light p-2">${qrText}</pre>
    `;

        // Habilitar botón de descarga
        const downloadQR = document.getElementById('downloadQR');
        downloadQR.disabled = false;
        downloadQR.onclick = function () {
            const canvas = document.createElement('canvas');
            const img = qrPlaceholder.querySelector('img');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const link = document.createElement('a');
            link.download = `qr_ganado_${animal.earTag}.png`;
            link.href = canvas.toDataURL();
            link.click();
        };
    }

    function viewAnimalDetails(id) {
        const animal = inventory.find(a => a.id === id);
        if (!animal) return;

        let html = `
        <div class="row">
            <div class="col-md-6">
                <h4>${animal.name}</h4>
                <hr>
                <p><strong>Tipo:</strong> ${animal.type}</p>
                <p><strong>Número de arete:</strong> ${animal.earTag}</p>
                <p><strong>Edad:</strong> ${animal.age} años</p>
                ${animal.type === 'ternero' && animal.birthDate ?
                `<p><strong>Fecha de nacimiento:</strong> ${new Date(animal.birthDate).toLocaleDateString()}</p>` : ''}
                <p><strong>Raza:</strong> ${animal.breed}</p>
                <p><strong>Sexo:</strong> ${animal.gender}</p>
            </div>
            <div class="col-md-6">
    `;

        if (animal.type === 'vaca') {
            html += `<p><strong>Total de partos:</strong> ${animal.births}</p>`;
        }

        html += `
                <p><strong>Fecha de registro:</strong> ${new Date(animal.registrationDate).toLocaleDateString()}</p>
    `;

        if (animal.notes) {
            html += `
                <hr>
                <p><strong>Observaciones:</strong></p>
                <p>${animal.notes}</p>
        `;
        }

        html += `
            </div>
        </div>
    `;

        document.getElementById('modalAnimalDetails').innerHTML = html;

        const modal = new bootstrap.Modal(document.getElementById('animalModal'));
        modal.show();
    }
    // Exportar a Excel
    document.getElementById('exportExcel').onclick = function () {
        if (inventory.length === 0) {
            Swal.fire({
                title: 'No hay datos',
                text: 'No hay animales registrados para exportar',
                icon: 'info',
                confirmButtonColor: '#2c8a47'
            });
            return;
        }

        const data = [
            ['Arete', 'Tipo', 'Nombre', 'Edad', 'Raza', 'Sexo', 'Partos', 'Fecha Registro', 'Observaciones'],
            ...inventory.map(animal => [
                animal.earTag,
                animal.type,
                animal.name,
                animal.age,
                animal.breed,
                animal.gender,
                animal.type === 'vaca' ? animal.births : 'N/A',
                new Date(animal.registrationDate).toLocaleDateString(),
                animal.notes || ''
            ])
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Inventario Ganado");
        XLSX.writeFile(wb, `Inventario_Ganado_${new Date().toISOString().slice(0, 10)}.xlsx`);

        Swal.fire({
            title: 'Exportación completada',
            text: 'El archivo Excel se ha generado correctamente',
            icon: 'success',
            confirmButtonColor: '#2c8a47',
            timer: 3000,
            timerProgressBar: true
        });
    };

    // Inicializar la interfaz
    initializeUI();
});