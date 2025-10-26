import React, { PureComponent } from "react"
import PropTypes from "prop-types"
import { Iterable } from "immutable"
import { createDeepLinkPath } from "core/utils"
import ImPropTypes from "react-immutable-proptypes"
import { validatePath } from "../utils/path-validation"

export default class OperationPath extends PureComponent{

  static propTypes = {
    specPath: ImPropTypes.list.isRequired,
    operationProps: PropTypes.instanceOf(Iterable).isRequired,
    getComponent: PropTypes.func.isRequired,
    isEditing: PropTypes.bool,
    selectedPath: PropTypes.string,
    onPathChange: PropTypes.func,
    currentPath: PropTypes.string,
  }

  static defaultProps = {
    isEditing: false,
    selectedPath: null,
    onPathChange: () => {},
    currentPath: null,
  }



  render(){
    let {
      getComponent,
      operationProps,
      isEditing,
      selectedPath,
      onPathChange,
      currentPath,
    } = this.props

    let {
      deprecated,
      isShown,
      path,
      tag,
      operationId,
      isDeepLinkingEnabled,
    } = operationProps.toJS()

    // Use currentPath if provided, otherwise fall back to path
    const displayPath = currentPath || path

    if (isEditing) {
      const currentValue = selectedPath || path
      const validation = validatePath(currentValue)
      
      return (
        <div className="opblock-summary-path-edit-wrapper">
          <input 
            className={`opblock-summary-path opblock-summary-path-edit ${!validation.isValid ? 'invalid' : ''}`}
            type="text"
            value={currentValue}
            onChange={(e) => {
              const newValue = e.target.value
              onPathChange(newValue)
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Enter path (e.g., /users/{id})"
          />
          {!validation.isValid && (
            <div className="opblock-summary-path-validation-error">
              {validation.error}
            </div>
          )}
        </div>
      )
    }

    /**
     * Add <wbr> word-break elements between each segment, before the slash
     * to allow browsers an opportunity to break long paths into sensible segments.
     */
    const pathParts = displayPath.split(/(?=\/)/g)
    for (let i = 1; i < pathParts.length; i += 2) {
      pathParts.splice(i, 0, <wbr key={i} />)
    }

    const DeepLink = getComponent( "DeepLink" )

    return(
      <span className={ deprecated ? "opblock-summary-path__deprecated" : "opblock-summary-path" }
        data-path={displayPath}>
        <DeepLink
            enabled={isDeepLinkingEnabled}
            isShown={isShown}
            path={createDeepLinkPath(`${tag}/${operationId}`)}
            text={pathParts} />
      </span>

    )
  }
}
