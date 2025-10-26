import React, { PureComponent } from "react"
import PropTypes from "prop-types"
import { Iterable } from "immutable"

export default class OperationMethod extends PureComponent {

  static propTypes = {
    operationProps: PropTypes.instanceOf(Iterable).isRequired,
    method: PropTypes.string.isRequired,
    isEditing: PropTypes.bool,
    onMethodChange: PropTypes.func,
  }

  static defaultProps = {
    operationProps: null,
    isEditing: false,
    onMethodChange: () => {},
  }

  render() {
    let {
      method,
      isEditing,
      onMethodChange,
    } = this.props

    if (isEditing) {
      const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']
      
      return (
        <select 
          className="opblock-summary-method opblock-summary-method-edit"
          value={method ? method.toLowerCase() : ''}
          onChange={(e) => onMethodChange(e.target.value.toLowerCase())}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {httpMethods.map(httpMethod => (
            <option key={httpMethod} value={httpMethod.toLowerCase()}>
              {httpMethod}
            </option>
          ))}
        </select>
      )
    }

    return (
      <span className="opblock-summary-method">{method.toUpperCase()}</span>
    )
  }
}
