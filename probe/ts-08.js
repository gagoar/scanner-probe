        if (this.isContextual("is") && !this.hasPrecedingLineBreak()) {
          this.next();
          return id;
        }
      }
      tsParseTypeOrTypePredicateAnnotation(returnToken) {
        return this.tsInType(() => {
          const t = this.startNode();
          this.expect(returnToken);
          const node = this.startNode();
          const typePredicateVariable = this.tsIsIdentifier() && this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this));
          if (typePredicateVariable) {
            const type2 = this.tsParseTypeAnnotation(
              false
            );
            node.parameterName = typePredicateVariable;
            node.typeAnnotation = type2;
            node.asserts = false;
            t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
            return this.finishNode(t, "TSTypeAnnotation");
          }
          const asserts = !!this.tsTryParse(this.tsParseTypePredicateAsserts.bind(this));
          if (asserts && this.match(tt._this)) {
            let thisTypePredicate = this.tsParseThisTypeOrThisTypePredicate();
            if (thisTypePredicate.type === "TSThisType") {
              node.parameterName = thisTypePredicate;
              node.asserts = true;
              node.typeAnnotation = null;
              thisTypePredicate = this.finishNode(node, "TSTypePredicate");
            } else {
              this.resetStartLocationFromNode(thisTypePredicate, node);
              thisTypePredicate.asserts = true;
            }
            t.typeAnnotation = thisTypePredicate;
            return this.finishNode(t, "TSTypeAnnotation");
          }
          const assertedTypePredicateVariable = asserts && this.tsIsIdentifier() && this.tsTryParse(this.tsParseTypePredicatePrefix.bind(this));
          if (!assertedTypePredicateVariable) {
            if (!asserts) {
              return this.tsParseTypeAnnotation(
                false,
                t
              );
            }
            node.parameterName = this.parseIdent();
            node.asserts = asserts;
            node.typeAnnotation = null;
            t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
            return this.finishNode(t, "TSTypeAnnotation");
          }
          const type = this.tsParseTypeAnnotation(
            false
          );
          node.parameterName = assertedTypePredicateVariable;
          node.typeAnnotation = type;
          node.asserts = asserts;
          t.typeAnnotation = this.finishNode(node, "TSTypePredicate");
          return this.finishNode(t, "TSTypeAnnotation");
        });
      }
      tsFillSignature(returnToken, signature) {
        const returnTokenRequired = returnToken === tt.arrow;
        const paramsKey = "parameters";
        const returnTypeKey = "typeAnnotation";
        signature.typeParameters = this.tsTryParseTypeParameters();
        this.expect(tt.parenL);
        signature[paramsKey] = this.tsParseBindingListForSignature();
        if (returnTokenRequired) {
          signature[returnTypeKey] = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
        } else if (this.match(returnToken)) {
          signature[returnTypeKey] = this.tsParseTypeOrTypePredicateAnnotation(returnToken);
        }
      }
      tsTryNextParseConstantContext() {
        if (this.lookahead().type !== tt._const) return null;
        this.next();
        const typeReference = this.tsParseTypeReference();
        if (typeReference.typeParameters || typeReference.typeArguments) {
          this.raise(
            typeReference.typeName.start,
            TypeScriptError.CannotFindName({
              name: "const"
            })
          );
        }
        return typeReference;
      }
      tsParseFunctionOrConstructorType(type, abstract) {
        const node = this.startNode();
        if (type === "TSConstructorType") {
          node.abstract = !!abstract;
          if (abstract) this.next();
          this.next();
        }
        this.tsInAllowConditionalTypesContext(() => this.tsFillSignature(tt.arrow, node));
        return this.finishNode(node, type);
      }
      tsParseUnionOrIntersectionType(kind, parseConstituentType, operator) {
        const node = this.startNode();
        const hasLeadingOperator = this.eat(operator);
        const types = [];
        do {
          types.push(parseConstituentType());
        } while (this.eat(operator));
        if (types.length === 1 && !hasLeadingOperator) {
          return types[0];
        }
        node.types = types;
        return this.finishNode(node, kind);
      }
      tsCheckTypeAnnotationForReadOnly(node) {
        switch (node.typeAnnotation.type) {
          case "TSTupleType":
          case "TSArrayType":
            return;
          default:
            this.raise(node.start, TypeScriptError.UnexpectedReadonly);
        }
      }
      tsParseTypeOperator() {
        const node = this.startNode();
        const operator = this.value;
        this.next();
        node.operator = operator;
        node.typeAnnotation = this.tsParseTypeOperatorOrHigher();
        if (operator === "readonly") {
          this.tsCheckTypeAnnotationForReadOnly(node);
        }
        return this.finishNode(node, "TSTypeOperator");
      }
      tsParseConstraintForInferType() {
        if (this.eat(tt._extends)) {
          const constraint = this.tsInDisallowConditionalTypesContext(() => this.tsParseType());
          if (this.inDisallowConditionalTypesContext || !this.match(tt.question)) {
            return constraint;
          }
        }
      }
      tsParseInferType() {
        const node = this.startNode();
        this.expectContextual("infer");
        const typeParameter = this.startNode();
        typeParameter.name = this.tsParseTypeParameterName();
        typeParameter.constraint = this.tsTryParse(() => this.tsParseConstraintForInferType());
        node.typeParameter = this.finishNode(typeParameter, "TSTypeParameter");
        return this.finishNode(node, "TSInferType");
      }
      tsParseLiteralTypeNode() {
        const node = this.startNode();
        node.literal = (() => {
          switch (this.type) {
            case tt.num:
            case tt.string:
            case tt._true:
            case tt._false:
              return this.parseExprAtom();
            default:
              this.unexpected();
          }
        })();
        return this.finishNode(node, "TSLiteralType");
      }
      tsParseImportType() {
        const node = this.startNode();
        this.expect(tt._import);
        this.expect(tt.parenL);
        if (!this.match(tt.string)) {
          this.raise(this.start, TypeScriptError.UnsupportedImportTypeArgument);
        }
        node.argument = this.parseExprAtom();
        this.expect(tt.parenR);
        if (this.eat(tt.dot)) {
          node.qualifier = this.tsParseEntityName();
        }
        if (this.tsMatchLeftRelational()) {
          node.typeArguments = this.tsParseTypeArguments();
        }
        return this.finishNode(node, "TSImportType");
      }
      tsParseTypeQuery() {
        const node = this.startNode();
        this.expect(tt._typeof);
        if (this.match(tt._import)) {
          node.exprName = this.tsParseImportType();
        } else {
          node.exprName = this.tsParseEntityName();
        }
        if (!this.hasPrecedingLineBreak() && this.tsMatchLeftRelational()) {
          node.typeArguments = this.tsParseTypeArguments();
        }
        return this.finishNode(node, "TSTypeQuery");
      }
      tsParseMappedTypeParameter() {
        const node = this.startNode();
        node.name = this.tsParseTypeParameterName();
        node.constraint = this.tsExpectThenParseType(tt._in);
        return this.finishNode(node, "TSTypeParameter");
      }
      tsParseMappedType() {
        const node = this.startNode();
        this.expect(tt.braceL);
        if (this.match(tt.plusMin)) {
          node.readonly = this.value;
          this.next();
          this.expectContextual("readonly");
        } else if (this.eatContextual("readonly")) {
          node.readonly = true;
        }
        this.expect(tt.bracketL);
        node.typeParameter = this.tsParseMappedTypeParameter();
        node.nameType = this.eatContextual("as") ? this.tsParseType() : null;
        this.expect(tt.bracketR);
        if (this.match(tt.plusMin)) {
          node.optional = this.value;
          this.next();
          this.expect(tt.question);
        } else if (this.eat(tt.question)) {
          node.optional = true;
        }
        node.typeAnnotation = this.tsTryParseType();
        this.semicolon();
        this.expect(tt.braceR);
        return this.finishNode(node, "TSMappedType");
      }
      tsParseTypeLiteral() {
        const node = this.startNode();
        node.members = this.tsParseObjectTypeMembers();
        return this.finishNode(node, "TSTypeLiteral");
      }
      tsIsTupleElementLabel() {
        if (!tokenIsKeywordOrIdentifier(this.type)) return false;
        const nextToken = this.lookahead();
        if (nextToken.type === tt.colon) return true;
        if (nextToken.type !== tt.question) return false;
        return this.lookahead(2).type === tt.colon;
      }
      tsParseTupleElementType() {
        const startLoc = this.startLoc;
        const startPos = this["start"];
        const rest = this.eat(tt.ellipsis);
        let type;
        if (this.tsIsTupleElementLabel()) {
          const labeledNode = this.startNode();
          labeledNode.label = this.parseIdent(true);
          labeledNode.optional = this.eat(tt.question);
          this.expect(tt.colon);
          labeledNode.elementType = this.tsParseType();
          type = this.finishNode(labeledNode, "TSNamedTupleMember");
        } else {
          type = this.tsParseType();
          const optional = this.eat(tt.question);
          if (this.eat(tt.colon)) {
            this.raise(type.start, TypeScriptError.InvalidTupleMemberLabel);
          }
          if (optional) {
            const optionalTypeNode = this.startNodeAtNode(type);
            optionalTypeNode.typeAnnotation = type;
            type = this.finishNode(optionalTypeNode, "TSOptionalType");
          }
        }
        if (rest) {
          const restNode = this.startNodeAt(startPos, startLoc);
          restNode.typeAnnotation = type;
          type = this.finishNode(restNode, "TSRestType");
        }
        return type;
      }
      tsParseTupleType() {
        const node = this.startNode();
        node.elementTypes = this.tsParseBracketedList(
          "TupleElementTypes",
          this.tsParseTupleElementType.bind(this),
          true,
          false
        );
        let seenOptionalElement = false;
        node.elementTypes.forEach((elementNode) => {
          const { type } = elementNode;
          if (seenOptionalElement && type !== "TSRestType" && type !== "TSOptionalType" && !(type === "TSNamedTupleMember" && elementNode.optional)) {
            this.raise(elementNode.start, TypeScriptError.OptionalTypeBeforeRequired);
          }
          seenOptionalElement ||= type === "TSNamedTupleMember" && elementNode.optional || type === "TSOptionalType";
          if (type === "TSRestType") {
            elementNode = elementNode.typeAnnotation;
          }
        });
        return this.finishNode(node, "TSTupleType");
      }
      tsParseTemplateLiteralType() {
        const node = this.startNode();
        node.literal = this.parseTemplate({ isTagged: false });
        return this.finishNode(node, "TSLiteralType");
      }
      tsParseTypeReference() {
        const node = this.startNode();
        node.typeName = this.tsParseEntityName();
        if (!this.hasPrecedingLineBreak() && this.tsMatchLeftRelational()) {
          node.typeArguments = this.tsParseTypeArguments();
        }
        return this.finishNode(node, "TSTypeReference");
      }
      tsMatchLeftRelational() {
        return this.match(tt.relational) && this.value === "<";
      }
      tsMatchRightRelational() {
        return this.match(tt.relational) && this.value === ">";
      }
      tsParseParenthesizedType() {
        const node = this.startNode();
        this.expect(tt.parenL);
        node.typeAnnotation = this.tsParseType();
        this.expect(tt.parenR);
        return this.finishNode(node, "TSParenthesizedType");
      }
      tsParseNonArrayType() {
        switch (this.type) {
          case tt.string:
          case tt.num:
          case tt._true:
          case tt._false:
            return this.tsParseLiteralTypeNode();
          case tt.plusMin:
            if (this.value === "-") {
              const node = this.startNode();
              const nextToken = this.lookahead();
              if (nextToken.type !== tt.num) {
                this.unexpected();
              }
              node.literal = this.parseMaybeUnary();
              return this.finishNode(node, "TSLiteralType");
            }
            break;
          case tt._this:
            return this.tsParseThisTypeOrThisTypePredicate();
          case tt._typeof:
            return this.tsParseTypeQuery();
          case tt._import:
            return this.tsParseImportType();
          case tt.braceL:
            return this.tsLookAhead(this.tsIsStartOfMappedType.bind(this)) ? this.tsParseMappedType() : this.tsParseTypeLiteral();
          case tt.bracketL:
            return this.tsParseTupleType();
