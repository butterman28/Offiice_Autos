// ============================================
// MUI Toolbar Component
// ============================================

const MUIToolbar = {
    init() {
        const toolbarHTML = `
            <div class="mui-app-bar">
                <div class="mui-toolbar">
                    <div class="mui-toolbar-section">
                        <button class="mui-button mui-button-primary" id="add-source">
                            <span class="mui-icon">📁</span>
                            <span>Add Source</span>
                        </button>
                        <button class="mui-button mui-button-success" id="add-dest">
                            <span class="mui-icon">📂</span>
                            <span>Add Destination</span>
                        </button>
                        <button class="mui-button mui-button-default" id="clear-arrows">
                            <span class="mui-icon">🗑️</span>
                            <span>Clear Connections</span>
                        </button>
                    </div>
                    
                    <div class="mui-toolbar-spacer"></div>
                    
                    <div class="mui-toolbar-section">
                        <div class="mui-stats" id="connection-stats">
                            <span class="mui-chip">0 connections</span>
                        </div>
                    </div>
                    
                    <div class="mui-toolbar-spacer"></div>
                    
                    <div class="mui-toolbar-section">
                        <button class="mui-button mui-button-warning" id="execute-move">
                            <span class="mui-icon">🚀</span>
                            <span>Move Files</span>
                        </button>
                        <button class="mui-button mui-button-info" id="execute-copy">
                            <span class="mui-icon">📋</span>
                            <span>Copy Files</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('mui-toolbar').innerHTML = toolbarHTML;
    },
    
    updateStats() {
        const statsEl = document.getElementById('connection-stats');
        const count = AppState.arrows.length;
        statsEl.innerHTML = `<span class="mui-chip">${count} connection${count !== 1 ? 's' : ''}</span>`;
    },
    
    showSnackbar(message, type = 'info') {
        const existing = document.querySelector('.mui-snackbar');
        if (existing) existing.remove();
        
        const snackbar = document.createElement('div');
        snackbar.className = `mui-snackbar mui-snackbar-${type}`;
        snackbar.innerHTML = `
            <div class="mui-snackbar-content">
                <span>${message}</span>
                <button class="mui-snackbar-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        
        document.body.appendChild(snackbar);
        
        setTimeout(() => snackbar.classList.add('show'), 10);
        setTimeout(() => {
            snackbar.classList.remove('show');
            setTimeout(() => snackbar.remove(), 300);
        }, 4000);
    }
};