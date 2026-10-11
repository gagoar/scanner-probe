      parseExportDeclaration(node) {
        if (!this.isAmbientContext && this.ts_isContextual(tokTypes.declare)) {
