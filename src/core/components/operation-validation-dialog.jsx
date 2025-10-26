import React from "react"
import PropTypes from "prop-types"

export default class OperationValidationDialog extends React.Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    errorMessage: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    getComponent: PropTypes.func.isRequired
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      this.props.onClose()
    }
  }

  render() {
    const { isOpen, errorMessage, onClose, getComponent } = this.props

    if (!isOpen) {
      return null
    }

    const Button = getComponent("Button")
    const CloseIcon = getComponent("CloseIcon")

    return (
      <div className="dialog-ux">
        <div className="backdrop-ux" onClick={onClose}></div>
        <div className="modal-ux">
          <div className="modal-dialog-ux">
            <div className="modal-ux-inner">
              <div className="modal-ux-header">
                <h3>Cannot save operation</h3>
                <button type="button" className="close-modal" onClick={onClose}>
                  {CloseIcon ? <CloseIcon /> : "✕"}
                </button>
              </div>
              <div className="modal-ux-content" onKeyDown={this.handleKeyDown}>
                <p>{errorMessage}</p>
                <div className="modal-actions-row">
                  <Button className="btn modal-btn" onClick={onClose}>OK</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
