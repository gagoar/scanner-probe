                forInit
              );
            }
          }
          return id;
        } else {
          return super.parseExprAtom(refDestructuringErrors, forInit, forNew);
        }
      }
      parseExprAtomDefault() {
        if (tokenIsIdentifier(this.type)) {
          const canBeArrow = this["potentialArrowAt"] === this.start;
          const containsEsc = this.containsEsc;
          const id = this.parseIdent();
          if (!containsEsc && id.name === "async" && !this.canInsertSemicolon()) {
            const { type } = this;
            if (type === tt._function) {
              this.next();
              return this.parseFunction(this.startNodeAtNode(id), void 0, true, true);
            } else if (tokenIsIdentifier(type)) {
              if (this.lookaheadCharCode() === 61) {
                const paramId = this.parseIdent(false);
