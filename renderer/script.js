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

  async function indexarRutaEspecifica() {
    const rutaSeleccionada = folderPathInput.value;
    
    if (!rutaSeleccionada) {
      actualizarEstadoIndexacion('Seleccione una carpeta primero', 'error');
      return;
    }
    
    indexFolderBtn.disabled = true;
    const textoOriginal = indexFolderBtn.innerHTML;
    indexFolderBtn.innerHTML = 'Indexando...';
    actualizarEstadoIndexacion('Indexando documentos...', 'loading');
    
    try {
      const resultado = await window.electronAPI.indexarCarpetaEspecifica(rutaSeleccionada);
      
      if (resultado.success) {
        const mensaje = `Completado: ${resultado.documentosIndexados || 0} nuevos, ${resultado.documentosExistentes || 0} existían`;
        actualizarEstadoIndexacion(mensaje, 'success');
        mostrarNotificacion(mensaje, 'success');
      } else {
        actualizarEstadoIndexacion(`Error: ${resultado.error}`, 'error');
      }
    } catch (error) {
      actualizarEstadoIndexacion(`Error: ${error.message}`, 'error');
    } finally {
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
});