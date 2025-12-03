// ============================================
// Global state management
// ============================================

const AppState = {
    groups: [],
    arrows: [],
    connectFrom: null,
    connectionLine: null,
    groupCounter: 0,
    
    addGroup(groupData) {
        this.groups.push(groupData);
    },
    
    removeGroup(group) {
        const index = this.groups.findIndex(g => g.group === group);
        if (index > -1) this.groups.splice(index, 1);
    },
    
    findGroup(group) {
        return this.groups.find(g => g.group === group);
    },
    
    addArrow(arrowData) {
        this.arrows.push(arrowData);
    },
    
    clearArrows() {
        this.arrows.forEach(a => a.arrow.destroy());
        this.arrows.forEach(a => a.arrowGroup.destroy());
        this.arrows = [];
    },
    removeArrow(arrowGroup) {
        const index = this.arrows.findIndex(a => a.arrowGroup === arrowGroup);
        if (index > -1) {
            // No need to destroy here — caller does it
            this.arrows.splice(index, 1);
        }
    },
    setConnectionStart(data) {
        this.connectFrom = data;
    },
    
    clearConnectionStart() {
        this.connectFrom = null;
        if (this.connectionLine) {
            this.connectionLine.destroy();
            this.connectionLine = null;
        }
    }
};