          case tt.parenL:
            return this.tsParseParenthesizedType();
          case tt.backQuote:
          case tt.dollarBraceL:
            return this.tsParseTemplateLiteralType();
          default: {
            const { type } = this;
            if (tokenIsKeywordOrIdentifier(type) || type === tt._void || type === tt._null) {
              const nodeType = type === tt._void ? "TSVoidKeyword" : type === tt._null ? "TSNullKeyword" : keywordTypeFromName(this.value);
              if (nodeType !== void 0 && this.lookaheadCharCode() !== 46) {
                const node = this.startNode();
                this.next();
                return this.finishNode(node, nodeType);
              }
              return this.tsParseTypeReference();
            }
          }
        }
        this.unexpected();
      }
      tsParseArrayTypeOrHigher() {
        let type = this.tsParseNonArrayType();
        while (!this.hasPrecedingLineBreak() && this.eat(tt.bracketL)) {
          if (this.match(tt.bracketR)) {
            const node = this.startNodeAtNode(type);
            node.elementType = type;
            this.expect(tt.bracketR);
            type = this.finishNode(node, "TSArrayType");
          } else {
            const node = this.startNodeAtNode(type);
            node.objectType = type;
            node.indexType = this.tsParseType();
            this.expect(tt.bracketR);
            type = this.finishNode(node, "TSIndexedAccessType");
          }
        }
        return type;
      }
      tsParseTypeOperatorOrHigher() {
        const isTypeOperator = tokenIsTSTypeOperator(this.type) && !this.containsEsc;
        return isTypeOperator ? this.tsParseTypeOperator() : this.isContextual("infer") ? this.tsParseInferType() : this.tsInAllowConditionalTypesContext(() => this.tsParseArrayTypeOrHigher());
      }
      tsParseIntersectionTypeOrHigher() {
        return this.tsParseUnionOrIntersectionType(
          "TSIntersectionType",
          this.tsParseTypeOperatorOrHigher.bind(this),
          tt.bitwiseAND
        );
      }
      tsParseUnionTypeOrHigher() {
        return this.tsParseUnionOrIntersectionType(
          "TSUnionType",
          this.tsParseIntersectionTypeOrHigher.bind(this),
          tt.bitwiseOR
        );
      }
      tsParseNonConditionalType() {
        if (this.tsIsStartOfFunctionType()) {
          return this.tsParseFunctionOrConstructorType("TSFunctionType");
        }
        if (this.match(tt._new)) {
          return this.tsParseFunctionOrConstructorType("TSConstructorType");
        } else if (this.isAbstractConstructorSignature()) {
          return this.tsParseFunctionOrConstructorType(
            "TSConstructorType",
            true
          );
        }
        return this.tsParseUnionTypeOrHigher();
      }
      tsParseType() {
        assert(this.inType);
        const type = this.tsParseNonConditionalType();
        if (this.inDisallowConditionalTypesContext || this.hasPrecedingLineBreak() || !this.eat(tt._extends)) {
          return type;
        }
        const node = this.startNodeAtNode(type);
        node.checkType = type;
        node.extendsType = this.tsInDisallowConditionalTypesContext(
          () => this.tsParseNonConditionalType()
        );
        this.expect(tt.question);
        node.trueType = this.tsInAllowConditionalTypesContext(() => this.tsParseType());
        this.expect(tt.colon);
        node.falseType = this.tsInAllowConditionalTypesContext(() => this.tsParseType());
        return this.finishNode(node, "TSConditionalType");
      }
      tsIsUnambiguouslyIndexSignature() {
        this.next();
        if (tokenIsIdentifier(this.type)) {
          this.next();
          return this.match(tt.colon);
        }
        return false;
      }
      tsInType(cb) {
        const oldInType = this.inType;
        this.inType = true;
        try {
          return cb();
        } finally {
          this.inType = oldInType;
        }
      }
      tsTryParseIndexSignature(node) {
        if (!(this.match(tt.bracketL) && this.tsLookAhead(this.tsIsUnambiguouslyIndexSignature.bind(this)))) {
          return void 0;
        }
        this.expect(tt.bracketL);
        const id = this.parseIdent();
        id.typeAnnotation = this.tsParseTypeAnnotation();
        this.resetEndLocation(id);
        this.expect(tt.bracketR);
        node.parameters = [id];
        const type = this.tsTryParseTypeAnnotation();
        if (type) node.typeAnnotation = type;
        this.tsParseTypeMemberSemicolon();
        return this.finishNode(node, "TSIndexSignature");
      }
      tsParseNoneModifiers(node) {
        this.tsParseModifiers({
          modified: node,
          allowedModifiers: [],
          disallowedModifiers: ["in", "out"],
          errorTemplate: TypeScriptError.InvalidModifierOnTypeParameterPositions
        });
      }
      tsParseTypeParameter(parseModifiers = this.tsParseNoneModifiers.bind(this)) {
        const node = this.startNode();
        parseModifiers(node);
        node.name = this.tsParseTypeParameterName();
        node.constraint = this.tsEatThenParseType(tt._extends);
        node.default = this.tsEatThenParseType(tt.eq);
        return this.finishNode(node, "TSTypeParameter");
      }
      tsParseTypeParameters(parseModifiers) {
        const node = this.startNode();
        if (this.tsMatchLeftRelational() || this.matchJsx("jsxTagStart")) {
          this.next();
        } else {
          this.unexpected();
        }
        const refTrailingCommaPos = { value: -1 };
        node.params = this.tsParseBracketedList(
          "TypeParametersOrArguments",
          this.tsParseTypeParameter.bind(this, parseModifiers),
          false,
          true,
          refTrailingCommaPos
        );
        if (node.params.length === 0) {
          this.raise(this.start, TypeScriptError.EmptyTypeParameters);
        }
        if (refTrailingCommaPos.value !== -1) {
          this.addExtra(node, "trailingComma", refTrailingCommaPos.value);
        }
        return this.finishNode(node, "TSTypeParameterDeclaration");
      }
      tsTryParseTypeParameters(parseModifiers) {
        if (this.tsMatchLeftRelational()) {
          return this.tsParseTypeParameters(parseModifiers);
        }
      }
      tsTryParse(f) {
        const frame = this.beginParseEffectScope();
        let result;
        try {
          result = f();
        } catch (error) {
          this.parseEffects.rollback(frame);
          throw error;
        }
        if (result !== void 0 && result !== false) {
          this.parseEffects.commit(frame);
          return result;
        }
        this.parseEffects.rollback(frame);
        return void 0;
      }
      tsTokenCanFollowModifier() {
        return (this.match(tt.bracketL) || this.match(tt.braceL) || this.match(tt.star) || this.match(tt.ellipsis) || this.match(tt.privateId) || this.isLiteralPropertyName()) && !this.hasPrecedingLineBreak();
      }
      tsNextTokenCanFollowModifier() {
        this.next(true);
        return this.tsTokenCanFollowModifier();
      }
      tsParseModifier(allowedModifiers, stopOnStartOfClassStaticBlock) {
        const modifier = this.value;
        if (allowedModifiers.indexOf(modifier) !== -1 && !this.containsEsc) {
          if (stopOnStartOfClassStaticBlock && this.tsIsStartOfStaticBlocks()) {
            return void 0;
          }
          if (this.tsTryParse(this.tsNextTokenCanFollowModifier.bind(this))) {
            return modifier;
          }
        }
        return void 0;
      }
      tsParseModifiersByMap({
        modified,
        map
      }) {
        for (const key of Object.keys(map)) {
          modified[key] = map[key];
        }
      }
      tsParseModifiers({
        modified,
        allowedModifiers,
        disallowedModifiers,
        stopOnStartOfClassStaticBlock,
        errorTemplate = TypeScriptError.InvalidModifierOnTypeMember
      }) {
        const modifiedMap = {};
        const enforceOrder = (loc, modifier, before, after) => {
          if (modifier === before && modified[after]) {
            this.raise(
              loc.column,
              TypeScriptError.InvalidModifiersOrder({ orderedModifiers: [before, after] })
            );
          }
        };
        const incompatible = (loc, modifier, mod1, mod2) => {
          if (modified[mod1] && modifier === mod2 || modified[mod2] && modifier === mod1) {
            this.raise(
              loc.column,
              TypeScriptError.IncompatibleModifiers({ modifiers: [mod1, mod2] })
            );
          }
        };
        for (; ; ) {
          const startLoc = this.startLoc;
          const modifier = this.tsParseModifier(
            allowedModifiers.concat(disallowedModifiers ?? []),
            stopOnStartOfClassStaticBlock
          );
          if (!modifier) break;
          if (tsIsAccessModifier(modifier)) {
            if (modified.accessibility) {
              this.raise(this.start, TypeScriptError.DuplicateAccessibilityModifier());
            } else {
              enforceOrder(startLoc, modifier, modifier, "override");
              enforceOrder(startLoc, modifier, modifier, "static");
              enforceOrder(startLoc, modifier, modifier, "readonly");
              enforceOrder(startLoc, modifier, modifier, "accessor");
              modifiedMap.accessibility = modifier;
              modified["accessibility"] = modifier;
            }
          } else if (tsIsVarianceAnnotations(modifier)) {
            if (modified[modifier]) {
              this.raise(this.start, TypeScriptError.DuplicateModifier({ modifier }));
            } else {
              enforceOrder(startLoc, modifier, "in", "out");
              modifiedMap[modifier] = modifier;
              modified[modifier] = true;
            }
          } else if (tsIsClassAccessor(modifier)) {
            if (modified[modifier]) {
              this.raise(this.start, TypeScriptError.DuplicateModifier({ modifier }));
            } else {
              incompatible(startLoc, modifier, "accessor", "readonly");
              incompatible(startLoc, modifier, "accessor", "override");
              modifiedMap[modifier] = modifier;
              modified[modifier] = true;
            }
          } else if (modifier === "const") {
            if (modified[modifier]) {
              this.raise(this.start, TypeScriptError.DuplicateModifier({ modifier }));
            } else {
              modifiedMap[modifier] = modifier;
              modified[modifier] = true;
            }
          } else {
            if (Object.hasOwnProperty.call(modified, modifier)) {
              this.raise(this.start, TypeScriptError.DuplicateModifier({ modifier }));
            } else {
              enforceOrder(startLoc, modifier, "static", "readonly");
              enforceOrder(startLoc, modifier, "static", "override");
              enforceOrder(startLoc, modifier, "override", "readonly");
              enforceOrder(startLoc, modifier, "abstract", "override");
              incompatible(startLoc, modifier, "declare", "override");
              incompatible(startLoc, modifier, "static", "abstract");
              modifiedMap[modifier] = modifier;
              modified[modifier] = true;
            }
          }
          if (disallowedModifiers?.includes(modifier)) {
            this.raise(this.start, errorTemplate);
          }
        }
        return modifiedMap;
      }
      tsParseInOutModifiers(node) {
        this.tsParseModifiers({
          modified: node,
          allowedModifiers: ["in", "out"],
          disallowedModifiers: [
            "public",
            "private",
            "protected",
            "readonly",
            "declare",
            "abstract",
            "override"
          ],
          errorTemplate: TypeScriptError.InvalidModifierOnTypeParameter
        });
      }
      tsParseClassTypeParameterModifiers(node) {
        this.tsParseModifiers({
          modified: node,
          allowedModifiers: ["const", "in", "out"],
          disallowedModifiers: [
            "public",
            "private",
            "protected",
            "readonly",
            "declare",
            "abstract",
            "override"
          ],
          errorTemplate: TypeScriptError.InvalidModifierOnTypeParameter
        });
      }
      parseMaybeUnary(refExpressionErrors, sawUnary, incDec, forInit) {
        if (!options?.jsx && this.tsMatchLeftRelational()) {
          return this.tsParseTypeAssertion();
        } else {
          return super.parseMaybeUnary(refExpressionErrors, sawUnary, incDec, forInit);
        }
      }
      tsParseTypeAssertion() {
        if (disallowAmbiguousJSXLike) {
          this.raise(this.start, TypeScriptError.ReservedTypeAssertion);
        }
        const result = this.tryParse(() => {
          const node = this.startNode();
          const _const = this.tsTryNextParseConstantContext();
          node.typeAnnotation = _const || this.tsNextThenParseType();
          this.expect(tt.relational);
          node.expression = this.parseMaybeUnary();
          return this.finishNode(node, "TSTypeAssertion");
