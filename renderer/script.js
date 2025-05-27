document.addEventListener('DOMContentLoaded', () => {
  // Referencias a elementos del DOM
  const searchBtn = document.getElementById('searchBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultsContainer = document.getElementById('results-container');
  const loadingIndicator = document.getElementById('loading');
  
  // Referencias para indexación de rutas
  const folderPathInput = document.getElementById('folderPath');
  const browseFolderBtn = document.getElementById('browseFolderBtn');
  const indexFolderBtn = document.getElementById('indexFolderBtn');
  const indexingStatus = document.getElementById('indexingStatus');

  // Variables para control de progreso
  let indexacionEnProgreso = false;
  let indexacionPausada = false;
  let indexacionCancelada = false;
  
  // Función para buscar documentos
  async function buscarDocumentos() {
    const keyword = document.getElementById('keyword').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const documentType = document.getElementById('documentType').value;
    
    loadingIndicator.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    
    try {
      const criterios = { keyword, dateFrom, dateTo, documentType };
      const resultados = await window.electronAPI.buscarDocumentos(criterios);
      
      if (resultados.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No se encontraron documentos que coincidan con los criterios de búsqueda.</div>';
      } else {
        mostrarResultados(resultados);
      }
    } catch (error) {
      resultsContainer.innerHTML = `<div class="error">Error al realizar la búsqueda: ${error.message}</div>`;
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  }
  
  // Función optimizada para mostrar resultados
  function mostrarResultados(resultados) {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    const tabla = document.createElement('table');
    tabla.className = 'results-table';
    
    // Crear encabezado
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Nombre</th>
        <th>Fecha</th>
        <th>Tipo</th>
        <th>Asunto</th>
        <th>Acciones</th>
      </tr>
    `;
    tabla.appendChild(thead);
    
    // Crear cuerpo de la tabla
    const tbody = document.createElement('tbody');
    
    resultados.forEach(doc => {
      const tr = document.createElement('tr');
      
      // Funciones auxiliares
      function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
      
      function formatearFecha(fecha) {
        if (!fecha) return 'N/A';
        try {
          if (typeof fecha === 'string' && fecha.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return fecha;
          }
          const date = new Date(fecha);
          if (isNaN(date.getTime())) {
            return fecha || 'N/A';
          }
          return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        } catch {
          return fecha || 'N/A';
        }
      }
      
      // Estructura de la fila con edición inline
      tr.innerHTML = `
        <td title="${escapeHtml(doc.nombre)}">${escapeHtml(doc.nombre)}</td>
        <td>${formatearFecha(doc.fecha)}</td>
        <td>${escapeHtml(doc.tipo || 'N/A')}</td>
        <td class="asunto-cell" data-ruta="${escapeHtml(doc.ruta)}">
          <div class="asunto-display">
            <span class="asunto-text" title="${escapeHtml(doc.asunto || 'Sin asunto')}">
              ${escapeHtml(doc.asunto || 'Sin asunto')}
            </span>
            <button class="btn-edit-asunto" title="Editar asunto">✏️</button>
          </div>
          <div class="asunto-edit">
            <input type="text" class="asunto-input" value="${escapeHtml(doc.asunto || '')}" placeholder="Escribir asunto...">
            <button class="btn-save-asunto" title="Guardar">💾</button>
            <button class="btn-cancel-asunto" title="Cancelar">✕</button>
          </div>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-open" data-path="${escapeHtml(doc.ruta)}" title="Abrir documento">Abrir</button>
            <button class="btn-copy" data-path="${escapeHtml(doc.ruta)}" title="Copiar ruta">Copiar</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    tabla.appendChild(tbody);
    tableContainer.appendChild(tabla);
    
    // Estadísticas
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
      margin-bottom: 16px; 
      padding: 12px 16px; 
      background: #f0f9ff; 
      border: 1px solid #bae6fd;
      border-radius: 6px; 
      color: #0c4a6e;
      font-weight: 500;
      font-size: 14px;
    `;
    statsDiv.innerHTML = `${resultados.length} documento${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}`;
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(statsDiv);
    resultsContainer.appendChild(tableContainer);
    
    // Eventos para edición de asuntos
    configurarEdicionAsuntos();
    configurarAccionesDocumentos();
  }
  
  // Configurar edición inline de asuntos
  function configurarEdicionAsuntos() {
    // Botones de editar
    document.querySelectorAll('.btn-edit-asunto').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cell = btn.closest('.asunto-cell');
        const displayDiv = cell.querySelector('.asunto-display');
        const editDiv = cell.querySelector('.asunto-edit');
        const input = cell.querySelector('.asunto-input');
        
        displayDiv.style.display = 'none';
        editDiv.style.display = 'flex';
        input.focus();
        input.select();
      });
    });
    
    // Botones de guardar
    document.querySelectorAll('.btn-save-asunto').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await guardarAsunto(btn);
      });
    });
    
    // Botones de cancelar
    document.querySelectorAll('.btn-cancel-asunto').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelarEdicion(btn);
      });
    });
    
    // Atajos de teclado
    document.querySelectorAll('.asunto-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const saveBtn = input.closest('.asunto-edit').querySelector('.btn-save-asunto');
          saveBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          const cancelBtn = input.closest('.asunto-edit').querySelector('.btn-cancel-asunto');
          cancelBtn.click();
        }
      });
    });
  }
  
  // Guardar asunto editado
  async function guardarAsunto(btn) {
    const cell = btn.closest('.asunto-cell');
    const ruta = cell.dataset.ruta;
    const input = cell.querySelector('.asunto-input');
    const nuevoAsunto = input.value.trim();
    
    if (nuevoAsunto === '') {
      mostrarNotificacion('El asunto no puede estar vacío', 'error');
      return;
    }
    
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳';
    
    try {
      const resultado = await window.electronAPI.actualizarAsuntoDocumento(ruta, nuevoAsunto);
      
      if (resultado.success) {
        // Actualizar vista
        const asuntoText = cell.querySelector('.asunto-text');
        asuntoText.textContent = nuevoAsunto;
        asuntoText.title = nuevoAsunto;
        
        // Volver a modo vista
        const displayDiv = cell.querySelector('.asunto-display');
        const editDiv = cell.querySelector('.asunto-edit');
        editDiv.style.display = 'none';
        displayDiv.style.display = 'flex';
        
        mostrarNotificacion('Asunto actualizado correctamente', 'success');
      } else {
        mostrarNotificacion(`Error: ${resultado.error}`, 'error');
      }
    } catch (error) {
      mostrarNotificacion(`Error al actualizar: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  }
  
  // Cancelar edición
  function cancelarEdicion(btn) {
    const cell = btn.closest('.asunto-cell');
    const displayDiv = cell.querySelector('.asunto-display');
    const editDiv = cell.querySelector('.asunto-edit');
    const input = cell.querySelector('.asunto-input');
    const originalValue = cell.querySelector('.asunto-text').textContent;
    
    input.value = originalValue;
    editDiv.style.display = 'none';
    displayDiv.style.display = 'flex';
  }
  
  // Configurar acciones de documentos
  function configurarAccionesDocumentos() {
    // Botones de abrir
    document.querySelectorAll('.btn-open').forEach(btn => {
      btn.addEventListener('click', async () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        btn.disabled = true;
        
        try {
          const resultado = await window.electronAPI.abrirDocumento(btn.dataset.path);
          if (!resultado.success) {
            mostrarNotificacion(`Error al abrir: ${resultado.error}`, 'error');
          } else {
            btn.innerHTML = '✓';
            setTimeout(() => {
              btn.innerHTML = originalText;
              btn.disabled = false;
            }, 2000);
          }
        } catch (error) {
          mostrarNotificacion(`Error: ${error.message}`, 'error');
        } finally {
          if (btn.innerHTML === '⏳') {
            btn.innerHTML = originalText;
            btn.disabled = false;
          }
        }
      });
    });
    
    // Botones de copiar
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.path);
          const originalText = btn.innerHTML;
          btn.innerHTML = '✓';
          setTimeout(() => {
            btn.innerHTML = originalText;
          }, 2000);
          mostrarNotificacion('Ruta copiada al portapapeles', 'success');
        } catch (err) {
          mostrarNotificacion(`Error al copiar: ${err.message}`, 'error');
        }
      });
    });
  }
  
  // Mostrar notificaciones
  function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.className = 'notification';
    
    const colores = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };
    
    notificacion.style.background = colores[tipo] || colores.info;
    notificacion.textContent = mensaje;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
      if (notificacion.parentNode) {
        notificacion.parentNode.removeChild(notificacion);
      }
    }, 3000);
  }
  
  // Funciones de indexación
  async function examinarCarpeta() {
    try {
      const resultado = await window.electronAPI.seleccionarCarpeta();
      if (resultado.success && resultado.path) {
        folderPathInput.value = resultado.path;
        indexFolderBtn.disabled = false;
        actualizarEstadoIndexacion('Carpeta seleccionada', 'success');
      }
    } catch (error) {
      actualizarEstadoIndexacion(`Error: ${error.message}`, 'error');
    }
  }
  // FUNCIÓN DE INDEXACIÓN ACTUALIZADA PARA SECCIÓN INTEGRADA
  async function indexarRutaEspecifica() {
    const rutaSeleccionada = folderPathInput.value;
    
    if (!rutaSeleccionada) {
      actualizarEstadoIndexacion('Seleccione una carpeta primero', 'error');
      return;
    }

    // Configurar estado inicial
    indexacionEnProgreso = true;
    indexacionPausada = false;
    indexacionCancelada = false;
    
    // Mostrar sección de progreso integrada
    resetProgressSection();
    showProgressSection();
    
    // Desactivar botón de indexar
    indexFolderBtn.disabled = true;
    const textoOriginal = indexFolderBtn.innerHTML;
    indexFolderBtn.innerHTML = 'Indexando...';
    actualizarEstadoIndexacion('Iniciando indexación...', 'loading');

    // Configurar listener para progreso en tiempo real
    const removerListener = window.electronAPI.onIndexacionProgreso((data) => {
      switch (data.tipo) {
        case 'inicio':
          updateProgressSection({
            total: data.total,
            processed: data.processed,
            success: data.success,
            errors: data.errors,
            currentFile: data.currentFile,
            elapsedTime: '00:00',
            estimatedTime: 'Calculando...'
          });
          break;

        case 'progreso':
          updateProgressSection({
            total: data.total,
            processed: data.processed,
            success: data.success,
            errors: data.errors,
            currentFile: data.currentFile,
            elapsedTime: data.elapsedTime,
            estimatedTime: data.estimatedTime
          });
          break;

        case 'error':
          addProgressError(data.archivo, data.error);
          break;

        case 'completado':
          updateProgressSection({
            total: data.total,
            processed: data.processed,
            success: data.success,
            errors: data.errors,
            currentFile: data.currentFile,
            elapsedTime: data.elapsedTime,
            estimatedTime: data.estimatedTime
          });

          // Marcar como completado y mostrar resumen
          markProgressCompleted();
          showProgressSummary({
            total: data.total,
            processed: data.processed,
            success: data.success,
            errors: data.errors,
            existing: data.existing,
            totalTime: data.elapsedTime
          });

          const mensaje = `Completado: ${data.success} nuevos, ${data.existing} existían, ${data.errors} errores`;
          actualizarEstadoIndexacion(mensaje, 'success');
          mostrarNotificacion(mensaje, 'success');
          break;        case 'error-general':
          actualizarEstadoIndexacion(`Error: ${data.error}`, 'error');
          mostrarNotificacion(`Error: ${data.error}`, 'error');
          hideProgressSection();
          break;

        case 'cancelado':
          updateProgressSection({
            total: data.total,
            processed: data.processed,
            success: data.success,
            errors: data.errors,
            existing: data.existing,
            currentFile: data.currentFile,
            elapsedTime: data.elapsedTime,
            estimatedTime: data.estimatedTime
          });

          markProgressCompleted();
          const mensajeCancelado = `Cancelado: ${data.success} procesados, ${data.existing} existían, ${data.errors} errores`;
          actualizarEstadoIndexacion(mensajeCancelado, 'info');
          mostrarNotificacion(mensajeCancelado, 'info');
          
          setTimeout(() => {
            hideProgressSection();
          }, 3000);
          break;
      }
    });
    
    try {
      // Ejecutar indexación (ahora con progreso en tiempo real)
      const resultado = await window.electronAPI.indexarCarpetaEspecifica(rutaSeleccionada);
      
      if (!resultado.success) {
        actualizarEstadoIndexacion(`Error: ${resultado.error}`, 'error');
        mostrarNotificacion(`Error: ${resultado.error}`, 'error');
        hideProgressSection();
      }
    } catch (error) {
      actualizarEstadoIndexacion(`Error: ${error.message}`, 'error');
      mostrarNotificacion(`Error: ${error.message}`, 'error');
      hideProgressSection();
    } finally {
      // Limpiar listener
      removerListener();
      indexacionEnProgreso = false;
      indexFolderBtn.disabled = false;
      indexFolderBtn.innerHTML = textoOriginal;
    }
  }

  function actualizarEstadoIndexacion(mensaje, tipo) {
    indexingStatus.textContent = mensaje;
    indexingStatus.className = `status-text ${tipo}`;
    indexingStatus.classList.remove('hidden');
    
    if (tipo === 'success') {
      setTimeout(() => {
        indexingStatus.classList.add('hidden');
      }, 5000);
    }
  }
  
  // Event listeners principales
  searchBtn.addEventListener('click', buscarDocumentos);
  
  resetBtn.addEventListener('click', () => {
    document.getElementById('keyword').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('documentType').value = '';
    resultsContainer.innerHTML = '';
    mostrarNotificacion('Formulario limpiado', 'info');
  });
  
  // Event listeners para indexación
  browseFolderBtn.addEventListener('click', examinarCarpeta);
  indexFolderBtn.addEventListener('click', indexarRutaEspecifica);
  
  // Búsqueda con Enter
  document.getElementById('keyword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      buscarDocumentos();
    }
  });

  // EVENT LISTENERS PARA CONTROLES DE LA SECCIÓN INTEGRADA
  const pauseBtn = document.getElementById('pause-progress-btn');
  const resumeBtn = document.getElementById('resume-progress-btn');
  const cancelBtn = document.getElementById('cancel-progress-btn');
    if (pauseBtn) {
    pauseBtn.addEventListener('click', async () => {
      if (indexacionEnProgreso && !indexacionPausada) {
        try {
          const resultado = await window.electronAPI.pausarIndexacion();
          if (resultado.success) {
            indexacionPausada = true;
            pauseBtn.classList.add('hidden');
            if (resumeBtn) resumeBtn.classList.remove('hidden');
            updateProgressSection({ currentFile: 'Pausado por el usuario...' });
            mostrarNotificacion('Indexación pausada', 'info');
          } else {
            mostrarNotificacion(`Error al pausar: ${resultado.message}`, 'error');
          }
        } catch (error) {
          mostrarNotificacion(`Error al pausar indexación: ${error.message}`, 'error');
        }
      }
    });
  }
  if (resumeBtn) {
    resumeBtn.addEventListener('click', async () => {
      if (indexacionEnProgreso && indexacionPausada) {
        try {
          const resultado = await window.electronAPI.reanudarIndexacion();
          if (resultado.success) {
            indexacionPausada = false;
            resumeBtn.classList.add('hidden');
            if (pauseBtn) pauseBtn.classList.remove('hidden');
            updateProgressSection({ currentFile: 'Reanudando indexación...' });
            mostrarNotificacion('Indexación reanudada', 'info');
          } else {
            mostrarNotificacion(`Error al reanudar: ${resultado.message}`, 'error');
          }
        } catch (error) {
          mostrarNotificacion(`Error al reanudar indexación: ${error.message}`, 'error');
        }
      }
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (indexacionEnProgreso) {
        if (confirm('¿Estás seguro de que quieres cancelar la indexación?')) {
          try {
            const resultado = await window.electronAPI.cancelarIndexacion();
            if (resultado.success) {
              indexacionCancelada = true;
              indexacionEnProgreso = false;
              updateProgressSection({ currentFile: 'Cancelado por el usuario' });
              
              mostrarNotificacion('Indexación cancelada. Los documentos procesados se han guardado.', 'info');
              
              setTimeout(() => {
                hideProgressSection();
              }, 2000);
            } else {
              mostrarNotificacion(`Error al cancelar: ${resultado.message}`, 'error');
            }
          } catch (error) {
            mostrarNotificacion(`Error al cancelar indexación: ${error.message}`, 'error');
          }
        }
      }
    });
  }
});

// ========================================
// FUNCIONES PARA SECCIÓN DE PROGRESO INTEGRADA
// ========================================

// Función para mostrar la sección de progreso
function showProgressSection() {
  const progressSection = document.getElementById('progress-section');
  if (progressSection) {
    progressSection.classList.remove('hidden');
  }
}

// Función para ocultar la sección de progreso
function hideProgressSection() {
  const progressSection = document.getElementById('progress-section');
  if (progressSection) {
    progressSection.classList.add('hidden');
  }
}

// Función para resetear la sección de progreso
function resetProgressSection() {
  const elements = {
    total: document.getElementById('counter-total'),
    processed: document.getElementById('counter-processed'),
    success: document.getElementById('counter-success'),
    errors: document.getElementById('counter-errors'),
    progressFill: document.getElementById('main-progress-fill'),
    progressPercentage: document.getElementById('main-progress-percentage'),
    currentFile: document.getElementById('current-processing-file'),
    timeElapsed: document.getElementById('time-elapsed'),
    timeEstimated: document.getElementById('time-estimated'),
    errorsContainer: document.getElementById('errors-container'),
    errorsContent: document.getElementById('errors-content'),
    pauseBtn: document.getElementById('pause-progress-btn'),
    resumeBtn: document.getElementById('resume-progress-btn')
  };
  
  // Resetear contadores
  if (elements.total) elements.total.textContent = '0';
  if (elements.processed) elements.processed.textContent = '0';
  if (elements.success) elements.success.textContent = '0';
  if (elements.errors) elements.errors.textContent = '0';
  
  // Resetear barra de progreso
  if (elements.progressFill) elements.progressFill.style.width = '0%';
  if (elements.progressPercentage) elements.progressPercentage.textContent = '0%';
  
  // Resetear archivo actual
  if (elements.currentFile) elements.currentFile.textContent = 'Iniciando...';
  
  // Resetear tiempos
  if (elements.timeElapsed) elements.timeElapsed.textContent = '00:00';
  if (elements.timeEstimated) elements.timeEstimated.textContent = 'Calculando...';
  
  // Ocultar errores
  if (elements.errorsContainer) elements.errorsContainer.classList.add('hidden');
  if (elements.errorsContent) {
    elements.errorsContent.classList.add('hidden');
    elements.errorsContent.innerHTML = '';
  }
  
  // Mostrar botón pausar, ocultar reanudar
  if (elements.pauseBtn) elements.pauseBtn.classList.remove('hidden');
  if (elements.resumeBtn) elements.resumeBtn.classList.add('hidden');
}

// Función para actualizar el progreso integrado
function updateProgressSection(data) {
  const elements = {
    total: document.getElementById('counter-total'),
    processed: document.getElementById('counter-processed'),
    success: document.getElementById('counter-success'),
    errors: document.getElementById('counter-errors'),
    progressFill: document.getElementById('main-progress-fill'),
    progressPercentage: document.getElementById('main-progress-percentage'),
    currentFile: document.getElementById('current-processing-file'),
    timeElapsed: document.getElementById('time-elapsed'),
    timeEstimated: document.getElementById('time-estimated'),
    errorsContainer: document.getElementById('errors-container'),
    errorsCountDisplay: document.getElementById('errors-count-display')
  };
  
  // Actualizar contadores
  if (data.total !== undefined && elements.total) {
    elements.total.textContent = data.total;
  }
  if (data.processed !== undefined && elements.processed) {
    elements.processed.textContent = data.processed;
  }
  if (data.success !== undefined && elements.success) {
    elements.success.textContent = data.success;
  }
  if (data.errors !== undefined && elements.errors) {
    elements.errors.textContent = data.errors;
  }
  
  // Actualizar barra de progreso
  if (data.total && data.processed !== undefined && elements.progressFill && elements.progressPercentage) {
    const percentage = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
  }
  
  // Actualizar archivo actual
  if (data.currentFile && elements.currentFile) {
    elements.currentFile.textContent = data.currentFile;
  }
  
  // Actualizar tiempos
  if (data.elapsedTime && elements.timeElapsed) {
    elements.timeElapsed.textContent = data.elapsedTime;
  }
  if (data.estimatedTime && elements.timeEstimated) {
    elements.timeEstimated.textContent = data.estimatedTime;
  }
  
  // Mostrar errores si los hay
  if (data.errors && data.errors > 0 && elements.errorsContainer && elements.errorsCountDisplay) {
    elements.errorsContainer.classList.remove('hidden');
    elements.errorsCountDisplay.textContent = data.errors;
  }
}

// Función para agregar un error a la lista integrada
function addProgressError(filename, errorMessage) {
  const errorsContent = document.getElementById('errors-content');
  if (errorsContent) {
    const errorItem = document.createElement('div');
    errorItem.className = 'error-item-inline';
    errorItem.textContent = `${filename}: ${errorMessage}`;
    errorsContent.appendChild(errorItem);
    
    // Actualizar contador de errores
    const currentErrors = parseInt(document.getElementById('counter-errors')?.textContent) || 0;
    updateProgressSection({ errors: currentErrors + 1 });
  }
}

// Función para mostrar/ocultar lista de errores
function toggleProgressErrors() {
  const errorsContent = document.getElementById('errors-content');
  const errorsArrow = document.querySelector('.errors-arrow');
  
  if (errorsContent && errorsArrow) {
    if (errorsContent.classList.contains('hidden')) {
      errorsContent.classList.remove('hidden');
      errorsArrow.classList.add('rotated');
    } else {
      errorsContent.classList.add('hidden');
      errorsArrow.classList.remove('rotated');
    }
  }
}

// Función para marcar como completado
function markProgressCompleted() {
  const progressSection = document.getElementById('progress-section');
  if (progressSection) {
    progressSection.classList.add('completed');
  }
  
  // Ocultar controles de pausa/reanudar
  const pauseBtn = document.getElementById('pause-progress-btn');
  const resumeBtn = document.getElementById('resume-progress-btn');
  
  if (pauseBtn) pauseBtn.classList.add('hidden');
  if (resumeBtn) resumeBtn.classList.add('hidden');
}

// Función para mostrar resumen final integrado
function showProgressSummary(data) {
  // Actualizar con datos finales
  updateProgressSection({
    total: data.total,
    processed: data.processed,
    success: data.success || data.processed,
    errors: data.errors || 0,
    currentFile: `✅ Completado: ${data.success || 0} nuevos, ${data.existing || 0} existían`,
    elapsedTime: data.totalTime || data.elapsedTime || '00:00',
    estimatedTime: 'Finalizado'
  });
  
  // Marcar como completado
  markProgressCompleted();
  
  // Auto-ocultar después de 10 segundos
  setTimeout(() => {
    hideProgressSection();
  }, 10000);
}