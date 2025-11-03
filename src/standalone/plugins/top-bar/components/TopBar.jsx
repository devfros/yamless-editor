import React, { cloneElement } from "react"
import PropTypes from "prop-types"
import { Map as ImmutableMap } from "immutable"
import YAML, { JSON_SCHEMA } from "js-yaml"

import {parseSearch, serializeSearch} from "core/utils"
import { isOAS31 } from "core/plugins/oas31/fn"

class TopBar extends React.Component {

  static propTypes = {
    layoutActions: PropTypes.object.isRequired,
    authActions: PropTypes.object.isRequired
  }

  constructor(props, context) {
    super(props, context)
    this.state = { url: props.specSelectors.url(), selectedIndex: 0 }
    this.fileInputRef = React.createRef()
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({ url: nextProps.specSelectors.url() })
  }

  onUrlChange =(e)=> {
    let {target: {value}} = e
    this.setState({url: value})
  }

  flushAuthData() {
    const { persistAuthorization } = this.props.getConfigs()
    if (persistAuthorization)
    {
      return
    }
    this.props.authActions.restoreAuthorization({
      authorized: {}
    })
  }

  loadSpec = (url) => {
    this.flushAuthData()
    this.props.specActions.updateUrl(url)
    this.props.specActions.download(url)
  }

  downloadCurrentSpec = () => {
    const { specSelectors } = this.props
    try {
      let specText = specSelectors.specStr()
      if(!specText) {
        const specJson = specSelectors.specJson()
        if(specJson && typeof specJson.toJS === "function") {
          specText = JSON.stringify(specJson.toJS(), null, 2)
        }
      }
      if(!specText) {
        return
      }
      const url = this.props.specSelectors.url()
      const fallbackName = "openapi.json"
      let filename = fallbackName
      try {
        if(url) {
          const parsed = new window.URL(url, window.location.href)
          const pathname = parsed.pathname || ""
          const last = pathname.split("/").filter(Boolean).pop()
          if(last && /\.ya?ml$/i.test(last)) {
            filename = last.replace(/\.ya?ml$/i, ".json")
          } else if(last && /\.json$/i.test(last)) {
            filename = last
          }
        }
      } catch(e) {
        // ignore filename parsing errors and use fallback
      }

      const blob = new Blob([specText], { type: "application/json;charset=utf-8" })
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      // no-op on failure
    }
  }

  handleUploadClick = () => {
    if (this.fileInputRef.current) {
      this.fileInputRef.current.click()
    }
  }

  handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    // Check file extension
    const fileName = file.name.toLowerCase()
    const isJson = fileName.endsWith('.json')
    const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml')

    if (!isJson && !isYaml) {
      const { errActions } = this.props
      if (errActions) {
        errActions.newSpecErr({
          source: "upload",
          level: "error",
          message: "Invalid file type. Please upload a JSON or YAML file."
        })
      }
      // Reset file input
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const fileContent = event.target.result

        // Parse the file content to validate it's valid JSON/YAML
        let parsedJson = null
        try {
          parsedJson = YAML.load(fileContent, { schema: JSON_SCHEMA })
        } catch (parseError) {
          const { errActions } = this.props
          if (errActions) {
            errActions.newSpecErr({
              source: "upload",
              level: "error",
              message: `Failed to parse file: ${parseError.message || "Invalid JSON or YAML format"}`
            })
          }
          // Reset file input
          e.target.value = ''
          return
        }

        // Validate it's an object
        if (!parsedJson || typeof parsedJson !== "object") {
          const { errActions } = this.props
          if (errActions) {
            errActions.newSpecErr({
              source: "upload",
              level: "error",
              message: "Invalid specification format. The file must contain a valid OpenAPI specification object."
            })
          }
          // Reset file input
          e.target.value = ''
          return
        }

        // Convert to Immutable Map for validation
        const jsSpec = ImmutableMap(parsedJson)

        // Validate it's OAS 3.1 before updating
        if (!isOAS31(jsSpec)) {
          const { errActions } = this.props
          if (errActions) {
            errActions.newSpecErr({
              source: "upload",
              level: "error",
              message: "Invalid OpenAPI version. Only OpenAPI 3.1 specifications are supported. Please ensure your spec has 'openapi: 3.1.x'."
            })
          }
          // Reset file input
          e.target.value = ''
          return
        }

        // All validations passed - update the spec
        this.flushAuthData()
        this.props.specActions.updateUrl("")
        this.props.specActions.updateSpec(fileContent)
        this.props.specActions.updateLoadingStatus("success")
      } catch (error) {
        const { errActions } = this.props
        if (errActions) {
          errActions.newSpecErr({
            source: "upload",
            level: "error",
            message: `Failed to process file: ${error.message}`
          })
        }
        // Reset file input
        e.target.value = ''
      }
    }

    reader.onerror = () => {
      const { errActions } = this.props
      if (errActions) {
        errActions.newSpecErr({
          source: "upload",
          level: "error",
          message: "Failed to read file. Please try again."
        })
      }
      // Reset file input
      e.target.value = ''
    }

    reader.readAsText(file)
  }


  onUrlSelect =(e)=> {
    let url = e.target.value || e.target.href
    this.loadSpec(url)
    this.setSelectedUrl(url)
    e.preventDefault()
  }

  downloadUrl = (e) => {
    this.loadSpec(this.state.url)
    e.preventDefault()
  }

  setSearch = (spec) => {
    let search = parseSearch()
    search["urls.primaryName"] = spec.name
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`
    if(window && window.history && window.history.pushState) {
      window.history.replaceState(null, "", `${newUrl}?${serializeSearch(search)}`)
    }
  }

  setSelectedUrl = (selectedUrl) => {
    const configs = this.props.getConfigs()
    const urls = configs.urls || []

    if(urls && urls.length) {
      if(selectedUrl)
      {
        urls.forEach((spec, i) => {
          if(spec.url === selectedUrl)
            {
              this.setState({selectedIndex: i})
              this.setSearch(spec)
            }
        })
      }
    }
  }

  componentDidMount() {
    const configs = this.props.getConfigs()
    const urls = configs.urls || []

    if(urls && urls.length) {
      var targetIndex = this.state.selectedIndex
      let search = parseSearch()
      let primaryName = search["urls.primaryName"] || configs.urls.primaryName
      if(primaryName)
      {
        urls.forEach((spec, i) => {
          if(spec.name === primaryName)
            {
              this.setState({selectedIndex: i})
              targetIndex = i
            }
        })
      }

      this.loadSpec(urls[targetIndex].url)
    }
  }

  onFilterChange =(e) => {
    let {target: {value}} = e
    this.props.layoutActions.updateFilter(value)
  }

  render() {
    let { getComponent, specSelectors, getConfigs } = this.props
    const Button = getComponent("Button")
    const Link = getComponent("Link")
    const Logo = getComponent("Logo")

    let isLoading = specSelectors.loadingStatus() === "loading"
    let isFailed = specSelectors.loadingStatus() === "failed"

    const classNames = ["download-url-input"]
    if (isFailed) classNames.push("failed")
    if (isLoading) classNames.push("loading")

    const { urls } = getConfigs()
    let control = []
    let formOnSubmit = null

    // if(urls) {
    //   let rows = []
    //   urls.forEach((link, i) => {
    //     rows.push(<option key={i} value={link.url}>{link.name}</option>)
    //   })

    //   control.push(
    //     <label className="select-label" htmlFor="select"><span>Select a definition</span>
    //       <select id="select" disabled={isLoading} onChange={ this.onUrlSelect } value={urls[this.state.selectedIndex].url}>
    //         {rows}
    //       </select>
    //     </label>
    //   )
    // }
    // else {
    //   formOnSubmit = this.downloadUrl
    //   control.push(
    //     <input
    //       className={classNames.join(" ")}
    //       type="text"
    //       onChange={this.onUrlChange}
    //       value={this.state.url}
    //       disabled={isLoading}
    //       id="download-url-input"
    //     />
    //   )
    //   control.push(<Button className="download-url-button" onClick={ this.downloadUrl }>Explore</Button>)
    // }

    return (
      <div className="topbar">
        <div className="wrapper">
          <div className="topbar-wrapper">
            <Link>
              <Logo/>
            </Link>
            <form className="download-url-wrapper" onSubmit={formOnSubmit}>
              {control.map((el, i) => cloneElement(el, { key: i }))}
            </form>
            <input
              type="file"
              ref={this.fileInputRef}
              onChange={this.handleFileChange}
              accept="application/json,.json,.yaml,.yml"
              style={{ display: "none" }}
            />
            <Button className="download-spec-button" onClick={this.handleUploadClick}>Upload</Button>
            <Button className="download-spec-button" onClick={ this.downloadCurrentSpec }>Download</Button>
          </div>
        </div>
      </div>
    )
  }
}

TopBar.propTypes = {
  specSelectors: PropTypes.object.isRequired,
  specActions: PropTypes.object.isRequired,
  errActions: PropTypes.object,
  getComponent: PropTypes.func.isRequired,
  getConfigs: PropTypes.func.isRequired
}

export default TopBar
