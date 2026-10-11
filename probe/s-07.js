              this.startNodeAt(startPos, startLoc),
              0,
              false,
              true,
              forInit
            );
          }
          if (canBeArrow && !this.canInsertSemicolon()) {
            if (this.eat(tt.arrow))
              return this.parseArrowExpression(
                this.startNodeAt(startPos, startLoc),
                [id],
                false,
                forInit
              );
            if (this.ecmaVersion >= 8 && id.name === "async" && this.type === tt.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
              id = this.parseIdent(false);
              if (this.canInsertSemicolon() || !this.eat(tt.arrow)) this.unexpected();
              return this.parseArrowExpression(
                this.startNodeAt(startPos, startLoc),
                [id],
                true,
