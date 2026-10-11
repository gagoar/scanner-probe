            this.next();
            return true;
          }
          return false;
        } else {
          return super.eatContextual(name);
        }
      }
      tsIsExternalModuleReference() {
        return this.isContextual("require") && this.lookaheadCharCode() === 40;
      }
      tsParseExternalModuleReference() {
        const node = this.startNode();
        this.expectContextual("require");
        this.expect(tt.parenL);
        if (!this.match(tt.string)) {
          this.unexpected();
        }
        node.expression = this.parseExprAtom();
        this.expect(tt.parenR);
        return this.finishNode(node, "TSExternalModuleReference");
      }
      tsParseEntityName(allowReservedWords = true) {
        let entity = this.parseIdent(allowReservedWords);
        while (this.eat(tt.dot)) {
          const node = this.startNodeAtNode(entity);
          node.left = entity;
          node.right = this.parseIdent(allowReservedWords);
          entity = this.finishNode(node, "TSQualifiedName");
        }
        return entity;
      }
      tsParseEnumMember() {
        const node = this.startNode();
        node.id = this.match(tt.string) ? this.parseLiteral(this.value) : this.parseIdent(
          true
        );
        if (this.eat(tt.eq)) {
          node.initializer = this.parseMaybeAssign();
        }
        return this.finishNode(node, "TSEnumMember");
      }
      tsParseEnumDeclaration(node, properties = {}) {
        if (properties.const) node.const = true;
        if (properties.declare) node.declare = true;
        this.expectContextual("enum");
        node.id = this.parseIdent();
        const bindingType = properties.const ? acornScope.BIND_TS_CONST_ENUM : acornScope.BIND_TS_ENUM;
        this.checkLValSimple(node.id, bindingType);
        this.expect(tt.braceL);
        node.members = this.tsParseDelimitedList("EnumMembers", this.tsParseEnumMember.bind(this));
        this.expect(tt.braceR);
        return this.finishNode(node, "TSEnumDeclaration");
      }
      tsParseModuleBlock() {
        const node = this.startNode();
        this.enterScope(TS_SCOPE_OTHER);
        this.expect(tt.braceL);
        node.body = [];
        while (this.type !== tt.braceR) {
          let stmt = this.parseStatement(null, true);
          node.body.push(stmt);
        }
        this.next();
        super.exitScope();
        return this.finishNode(node, "TSModuleBlock");
      }
      tsParseAmbientExternalModuleDeclaration(node) {
        if (this.ts_isContextual(tokTypes.global)) {
          node.global = true;
          node.id = this.parseIdent();
        } else if (this.match(tt.string)) {
          node.id = this.parseLiteral(this.value);
        } else {
          this.unexpected();
        }
        if (this.match(tt.braceL)) {
          this.enterScope(TS_SCOPE_TS_MODULE);
          node.body = this.tsParseModuleBlock();
          super.exitScope();
        } else {
          super.semicolon();
        }
        return this.finishNode(node, "TSModuleDeclaration");
      }
      tsTryParseDeclare(nany) {
        if (this.isLineTerminator()) {
          return;
        }
        let starttype = this.type;
        let kind;
        if (this.isContextual("let")) {
          starttype = tt._var;
          kind = "let";
        }
        return this.tsInAmbientContext(() => {
          if (starttype === tt._function) {
            nany.declare = true;
            return this.parseFunctionStatement(
              nany,
              false,
              true
            );
          }
          if (starttype === tt._class) {
            nany.declare = true;
            return this.parseClass(nany, true);
          }
          if (starttype === tokTypes.enum) {
            return this.tsParseEnumDeclaration(nany, { declare: true });
          }
          if (starttype === tokTypes.global) {
            return this.tsParseAmbientExternalModuleDeclaration(nany);
          }
          if (starttype === tt._const || starttype === tt._var) {
            if (!this.match(tt._const) || !this.isLookaheadContextual("enum")) {
              nany.declare = true;
              return this.parseVarStatement(nany, kind || this.value, true);
            }
            this.expect(tt._const);
            return this.tsParseEnumDeclaration(nany, {
              const: true,
              declare: true
            });
          }
          if (starttype === tokTypes.interface) {
            const result = this.tsParseInterfaceDeclaration(nany, {
              declare: true
            });
            if (result) return result;
          }
          if (tokenIsIdentifier(starttype)) {
            return this.tsParseDeclaration(
              nany,
              this.value,
              true
            );
          }
        });
      }
      tsIsListTerminator(kind) {
        switch (kind) {
          case "EnumMembers":
          case "TypeMembers":
            return this.match(tt.braceR);
          case "HeritageClauseElement":
            return this.match(tt.braceL);
          case "TupleElementTypes":
            return this.match(tt.bracketR);
          case "TypeParametersOrArguments":
            return this.tsMatchRightRelational();
        }
      }
      tsParseDelimitedListWorker(kind, parseElement, expectSuccess, refTrailingCommaPos) {
        const result = [];
        let trailingCommaPos = -1;
        for (; ; ) {
          if (this.tsIsListTerminator(kind)) {
            break;
          }
          trailingCommaPos = -1;
          const element = parseElement();
          if (element == null) {
            return void 0;
          }
          result.push(element);
          if (this.eat(tt.comma)) {
            trailingCommaPos = this.lastTokStart;
            continue;
          }
          if (this.tsIsListTerminator(kind)) {
            break;
          }
          if (expectSuccess) {
            this.expect(tt.comma);
          }
          return void 0;
        }
        if (refTrailingCommaPos) {
          refTrailingCommaPos.value = trailingCommaPos;
        }
        return result;
      }
      tsParseDelimitedList(kind, parseElement, refTrailingCommaPos) {
        return nonNull(
          this.tsParseDelimitedListWorker(
            kind,
            parseElement,
            true,
            refTrailingCommaPos
          )
        );
      }
      tsParseBracketedList(kind, parseElement, bracket, skipFirstToken, refTrailingCommaPos) {
        if (!skipFirstToken) {
          if (bracket) {
            this.expect(tt.bracketL);
          } else {
            this.expect(tt.relational);
          }
        }
        const result = this.tsParseDelimitedList(kind, parseElement, refTrailingCommaPos);
        if (bracket) {
          this.expect(tt.bracketR);
        } else {
          this.expect(tt.relational);
        }
        return result;
      }
      tsParseTypeParameterName() {
        const typeName = this.parseIdent();
        return typeName.name;
      }
      tsEatThenParseType(token) {
        return !this.match(token) ? void 0 : this.tsNextThenParseType();
      }
      tsExpectThenParseType(token) {
        return this.tsDoThenParseType(() => this.expect(token));
      }
      tsNextThenParseType() {
        return this.tsDoThenParseType(() => this.next());
      }
      tsDoThenParseType(cb) {
        return this.tsInType(() => {
          cb();
          return this.tsParseType();
        });
      }
      tsSkipParameterStart() {
        if (tokenIsIdentifier(this.type) || this.match(tt._this)) {
          this.next();
          return true;
        }
        if (this.match(tt.braceL)) {
          try {
            this.parseObj(true);
            return true;
          } catch {
            return false;
          }
        }
        if (this.match(tt.bracketL)) {
          this.next();
          try {
            this.parseBindingList(tt.bracketR, true, true);
            return true;
          } catch {
            return false;
          }
        }
        return false;
      }
      tsIsUnambiguouslyStartOfFunctionType() {
        this.next();
        if (this.match(tt.parenR) || this.match(tt.ellipsis)) {
          return true;
        }
        if (this.tsSkipParameterStart()) {
          if (this.match(tt.colon) || this.match(tt.comma) || this.match(tt.question) || this.match(tt.eq)) {
            return true;
          }
          if (this.match(tt.parenR)) {
            this.next();
            if (this.match(tt.arrow)) {
              return true;
            }
          }
        }
        return false;
      }
      tsIsStartOfFunctionType() {
        if (this.tsMatchLeftRelational()) {
          return true;
        }
        return this.match(tt.parenL) && this.tsLookAhead(this.tsIsUnambiguouslyStartOfFunctionType.bind(this));
      }
      tsInAllowConditionalTypesContext(cb) {
        const oldInDisallowConditionalTypesContext = this.inDisallowConditionalTypesContext;
        this.inDisallowConditionalTypesContext = false;
        try {
          return cb();
        } finally {
          this.inDisallowConditionalTypesContext = oldInDisallowConditionalTypesContext;
        }
      }
      tsParseBindingListForSignature() {
        return super.parseBindingList(tt.parenR, true, true).map((pattern) => {
          if (pattern.type !== "Identifier" && pattern.type !== "RestElement" && pattern.type !== "ObjectPattern" && pattern.type !== "ArrayPattern") {
            this.raise(
              pattern.start,
              TypeScriptError.UnsupportedSignatureParameterKind({ type: pattern.type })
            );
          }
          return pattern;
        });
      }
      tsParseTypePredicateAsserts() {
        if (this.type !== tokTypes.asserts) {
          return false;
        }
        const containsEsc = this.containsEsc;
        this.next();
        if (!tokenIsIdentifier(this.type) && !this.match(tt._this)) {
          return false;
        }
        if (containsEsc) {
          this.raise(this.lastTokStart, "Escape sequence in keyword asserts");
        }
        return true;
      }
      tsParseThisTypeNode() {
        const node = this.startNode();
        this.next();
        return this.finishNode(node, "TSThisType");
      }
      tsParseTypeAnnotation(eatColon = true, t = this.startNode()) {
        this.tsInType(() => {
          if (eatColon) this.expect(tt.colon);
          t.typeAnnotation = this.tsParseType();
        });
        return this.finishNode(t, "TSTypeAnnotation");
      }
      tsParseThisTypePredicate(lhs) {
        this.next();
        const node = this.startNodeAtNode(lhs);
        node.parameterName = lhs;
        node.typeAnnotation = this.tsParseTypeAnnotation(
          false
        );
        node.asserts = false;
        return this.finishNode(node, "TSTypePredicate");
      }
      tsParseThisTypeOrThisTypePredicate() {
        const thisKeyword = this.tsParseThisTypeNode();
        if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
          return this.tsParseThisTypePredicate(thisKeyword);
        } else {
          return thisKeyword;
        }
      }
      tsParseTypePredicatePrefix() {
        const id = this.parseIdent();
