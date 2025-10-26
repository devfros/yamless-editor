import React, { PureComponent } from "react"
import PropTypes from "prop-types"
import ImPropTypes from "react-immutable-proptypes"
import { opId } from "swagger-client/es/helpers"
import { Iterable, fromJS, Map } from "immutable"
import { validatePath, checkOperationExists } from "../utils/path-validation"

export default class OperationContainer extends PureComponent {
  constructor(props, context) {
    super(props, context)

    const { tryItOutEnabled } = props.getConfigs()

    this.state = {
      tryItOutEnabled,
      executeInProgress: false,
      isEditing: false,
      selectedSummary: null,
      selectedDescription: null,
      selectedMethod: null,
      selectedPath: null,
      showValidationDialog: false,
      validationError: ""
    }
  }

  static propTypes = {
    op: PropTypes.instanceOf(Iterable).isRequired,
    tag: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    method: PropTypes.string.isRequired,
    operationId: PropTypes.string.isRequired,
    showSummary: PropTypes.bool.isRequired,
    isShown: PropTypes.bool.isRequired,
    jumpToKey: PropTypes.string.isRequired,
    allowTryItOut: PropTypes.bool,
    displayOperationId: PropTypes.bool,
    isAuthorized: PropTypes.bool,
    displayRequestDuration: PropTypes.bool,
    response: PropTypes.instanceOf(Iterable),
    request: PropTypes.instanceOf(Iterable),
    security: PropTypes.instanceOf(Iterable),
    isDeepLinkingEnabled: PropTypes.bool.isRequired,
    specPath: ImPropTypes.list.isRequired,
    getComponent: PropTypes.func.isRequired,
    authActions: PropTypes.object,
    oas3Actions: PropTypes.object,
    oas3Selectors: PropTypes.object,
    authSelectors: PropTypes.object,
    specActions: PropTypes.object.isRequired,
    specSelectors: PropTypes.object.isRequired,
    layoutActions: PropTypes.object.isRequired,
    layoutSelectors: PropTypes.object.isRequired,
    fn: PropTypes.object.isRequired,
    getConfigs: PropTypes.func.isRequired
  }

  static defaultProps = {
    showSummary: true,
    response: null,
    allowTryItOut: true,
    displayOperationId: false,
    displayRequestDuration: false
  }

  mapStateToProps(nextState, props) {
    const { op, layoutSelectors, getConfigs } = props
    const { docExpansion, deepLinking, displayOperationId, displayRequestDuration, supportedSubmitMethods } = getConfigs()
    const showSummary = layoutSelectors.showSummary()
    const operationId = op.getIn(["operation", "__originalOperationId"]) || op.getIn(["operation", "operationId"]) || opId(op.get("operation"), props.path, props.method) || op.get("id")
    const isShownKey = ["operations", props.tag, operationId]
    const allowTryItOut = supportedSubmitMethods.indexOf(props.method) >= 0 && (typeof props.allowTryItOut === "undefined" ?
      props.specSelectors.allowTryItOutFor(props.path, props.method) : props.allowTryItOut)
    const security = op.getIn(["operation", "security"]) || props.specSelectors.security()

    return {
      operationId,
      isDeepLinkingEnabled: deepLinking,
      showSummary,
      displayOperationId,
      displayRequestDuration,
      allowTryItOut,
      security,
      isAuthorized: props.authSelectors.isAuthorized(security),
      isShown: layoutSelectors.isShown(isShownKey, docExpansion === "full" ),
      jumpToKey: `paths.${props.path}.${props.method}`,
      response: props.specSelectors.responseFor(props.path, props.method),
      request: props.specSelectors.requestFor(props.path, props.method)
    }
  }

  componentDidMount() {
    const { isShown } = this.props
    const resolvedSubtree = this.getResolvedSubtree()

    if(isShown && resolvedSubtree === undefined) {
      this.requestResolvedSubtree()
    }
  }

  componentDidUpdate(prevProps) {
    const { response, isShown } = this.props
    const resolvedSubtree = this.getResolvedSubtree()
  
    if (response !== prevProps.response) {
      this.setState({ executeInProgress: false })
    }
  
    if (isShown && resolvedSubtree === undefined && !prevProps.isShown) {
      this.requestResolvedSubtree()
    }
  }

  toggleShown =() => {
    let { layoutActions, tag, operationId, isShown } = this.props
    const resolvedSubtree = this.getResolvedSubtree()
    if(!isShown && resolvedSubtree === undefined) {
      // transitioning from collapsed to expanded
      this.requestResolvedSubtree()
    }
    layoutActions.show(["operations", tag, operationId], !isShown)
  }

  onCancelClick=() => {
    this.setState({tryItOutEnabled: !this.state.tryItOutEnabled})
  }

  onTryoutClick =() => {
    this.setState({tryItOutEnabled: !this.state.tryItOutEnabled})
  }

  onResetClick = (pathMethod) => {
    const defaultRequestBodyValue = this.props.oas3Selectors.selectDefaultRequestBodyValue(...pathMethod)
    const contentType = this.props.oas3Selectors.requestContentType(...pathMethod)

    if (contentType === "application/x-www-form-urlencoded" || contentType === "multipart/form-data") {
      const jsonRequestBodyValue = JSON.parse(defaultRequestBodyValue)
      Object.entries(jsonRequestBodyValue).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          jsonRequestBodyValue[key] = jsonRequestBodyValue[key].map((val) => {
            if (typeof val === "object") {
              return JSON.stringify(val, null, 2)
            } 
            return val
          })
        } else if (typeof value === "object") {
          jsonRequestBodyValue[key] = JSON.stringify(jsonRequestBodyValue[key], null, 2)
        }
      })
      this.props.oas3Actions.setRequestBodyValue({ value: fromJS(jsonRequestBodyValue), pathMethod })
    } else {
      this.props.oas3Actions.setRequestBodyValue({ value: defaultRequestBodyValue, pathMethod })
    }
  }

  onExecute = () => {
    this.setState({ executeInProgress: true })
  }

  handleEditClick = () => {
    const { path, method } = this.props
    const resolvedSubtree = this.getResolvedSubtree() || new Map()
    
    // Get summary and description from the resolved operation data
    const summary = resolvedSubtree.get("summary") || ''
    const description = resolvedSubtree.get("description") || ''
    
    this.setState({
      isEditing: true,
      selectedSummary: summary,
      selectedDescription: description,
      selectedMethod: method,
      selectedPath: path
    })
  }

  handleCancelClick = () => {
    this.setState({
      isEditing: false,
      selectedSummary: null,
      selectedDescription: null,
      selectedMethod: null,
      selectedPath: null
    })
  }

  handleSummaryChange = (newSummary) => {
    this.setState({ selectedSummary: newSummary })
  }

  handleDescriptionChange = (newDescription) => {
    this.setState({ selectedDescription: newDescription })
  }

  handleMethodChange = (newMethod) => {
    this.setState({ selectedMethod: newMethod })
  }

  handlePathChange = (newPath) => {
    this.setState({ selectedPath: newPath })
  }

  showValidationDialog = (errorMessage) => {
    this.setState({
      showValidationDialog: true,
      validationError: errorMessage
    })
  }

  closeValidationDialog = () => {
    this.setState({
      showValidationDialog: false,
      validationError: ""
    })
  }

  handleSaveClick = () => {
    const { specActions, path, method } = this.props
    const { selectedMethod, selectedPath, selectedSummary, selectedDescription } = this.state

    // Validate path if it's being changed
    if (selectedPath && selectedPath !== path) {
      const pathValidation = validatePath(selectedPath)
      if (!pathValidation.isValid) {
        this.showValidationDialog(pathValidation.error)
        return
      }
    }

    // Check for uniqueness conflicts
    const finalPath = selectedPath || path
    const finalMethod = selectedMethod || method
    
    // Only check for conflicts if path or method is actually changing
    if ((finalPath !== path || finalMethod !== method) && 
        checkOperationExists(this.props.specSelectors, finalPath, finalMethod)) {
      this.showValidationDialog(`An operation with method '${finalMethod.toUpperCase()}' and path '${finalPath}' already exists`)
      return
    }

    // Handle both path and method changes with correct logic
    if (selectedPath && selectedPath !== path) {
      // Path is changing - move the operation to the new path
      if (selectedMethod && selectedMethod !== method) {
        // Both path and method are changing
        // First move to new path with old method, then change method
        specActions.updateOperationPath(path, selectedPath, method)
        specActions.updateOperationMethod(selectedPath, method, selectedMethod)
      } else {
        // Only path is changing
        specActions.updateOperationPath(path, selectedPath, method)
      }
    } else if (selectedMethod && selectedMethod !== method) {
      // Only method is changing
      specActions.updateOperationMethod(path, method, selectedMethod)
    }

    // Get current values to compare against
    const resolvedSubtree = this.getResolvedSubtree() || new Map()
    const currentSummary = resolvedSubtree.get("summary") || ''
    const currentDescription = resolvedSubtree.get("description") || ''
    
    // Update summary and description fields only if they actually changed
    const updates = {}
    if (selectedSummary !== null && selectedSummary !== currentSummary) {
      updates.summary = selectedSummary
    }
    if (selectedDescription !== null && selectedDescription !== currentDescription) {
      updates.description = selectedDescription
    }
    
    // Reset editing state first
    this.setState({
      isEditing: false,
      selectedSummary: null,
      selectedDescription: null,
      selectedMethod: null,
      selectedPath: null
    })

    // Only call updateOperationFields if we have actual changes
    if (Object.keys(updates).length > 0) {
      specActions.updateOperationFields(finalPath, finalMethod, updates)
    }
  }


  getResolvedSubtree = () => {
    const {
      specSelectors,
      path,
      method,
      specPath
    } = this.props

    if(specPath) {
      return specSelectors.specResolvedSubtree(specPath.toJS())
    }

    return specSelectors.specResolvedSubtree(["paths", path, method])
  }

  requestResolvedSubtree = () => {
    const {
      specActions,
      path,
      method,
      specPath
    } = this.props


    if(specPath) {
      return specActions.requestResolvedSubtree(specPath.toJS())
    }

    return specActions.requestResolvedSubtree(["paths", path, method])
  }

  render() {
    let {
      op: unresolvedOp,
      tag,
      path,
      method,
      security,
      isAuthorized,
      operationId,
      showSummary,
      isShown,
      jumpToKey,
      allowTryItOut,
      response,
      request,
      displayOperationId,
      displayRequestDuration,
      isDeepLinkingEnabled,
      specPath,
      specSelectors,
      specActions,
      getComponent,
      getConfigs,
      layoutSelectors,
      layoutActions,
      authActions,
      authSelectors,
      oas3Actions,
      oas3Selectors,
      fn
    } = this.props

    const Operation = getComponent( "operation" )

    const resolvedSubtree = this.getResolvedSubtree() || new Map()

    const operationProps = fromJS({
      op: resolvedSubtree,
      tag,
      path,
      summary: unresolvedOp.getIn(["operation", "summary"]) || "",
      deprecated: resolvedSubtree.get("deprecated") || unresolvedOp.getIn(["operation", "deprecated"]) || false,
      method,
      security,
      isAuthorized,
      operationId,
      originalOperationId: resolvedSubtree.getIn(["operation", "__originalOperationId"]),
      showSummary,
      isShown,
      jumpToKey,
      allowTryItOut,
      request,
      displayOperationId,
      displayRequestDuration,
      isDeepLinkingEnabled,
      executeInProgress: this.state.executeInProgress,
      tryItOutEnabled: this.state.tryItOutEnabled
    })

    return (
      <Operation
        operation={operationProps}
        response={response}
        request={request}
        isShown={isShown}

        toggleShown={this.toggleShown}
        onTryoutClick={this.onTryoutClick}
        onResetClick={this.onResetClick}
        onCancelClick={this.onCancelClick}
        onExecute={this.onExecute}
        specPath={specPath}

        specActions={ specActions }
        specSelectors={ specSelectors }
        oas3Actions={oas3Actions}
        oas3Selectors={oas3Selectors}
        layoutActions={ layoutActions }
        layoutSelectors={ layoutSelectors }
        authActions={ authActions }
        authSelectors={ authSelectors }
        getComponent={ getComponent }
        getConfigs={ getConfigs }
        fn={fn}
        
        // Pass editing state from container state
        isEditing={this.state.isEditing}
        selectedSummary={this.state.selectedSummary}
        selectedDescription={this.state.selectedDescription}
        selectedMethod={this.state.selectedMethod}
        selectedPath={this.state.selectedPath}
        onSummaryChange={this.handleSummaryChange}
        onDescriptionChange={this.handleDescriptionChange}
        onMethodChange={this.handleMethodChange}
        onPathChange={this.handlePathChange}
        onEditClick={this.handleEditClick}
        onSaveClick={this.handleSaveClick}
        onCancelEdit={this.handleCancelClick}
        showValidationDialog={this.state.showValidationDialog}
        validationError={this.state.validationError}
        onCloseValidationDialog={this.closeValidationDialog}
      />
    )
  }

}
