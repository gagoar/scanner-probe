        const startLoc = this.startLoc;
        const isDeclare = this.eatContextual("declare");
        if (isDeclare && (this.ts_isContextual(tokTypes.declare) || !this.shouldParseExportStatement())) {
