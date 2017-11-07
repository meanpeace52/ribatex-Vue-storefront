'use strict'

const shell = require('shelljs')
const mkdirp = require('mkdirp')
const exists = require('fs-exists-sync')
const message = require('print-message')
const inquirer = require('inquirer')
const jsonFile = require('jsonfile')
const urlParser = require('url-parse')
const isWindows = require('is-windows')
const isEmptyDir = require('empty-dir')
const commandExists = require('command-exists')

const TARGET_CONFIG_FILE = 'src/config.json'
const SAMPLE_DATA_PATH = 'var/magento2-sample-data'
const SOURCE_CONFIG_FILE = 'src/config.example.json'

const STOREFRONT_REMOTE_BACKEND_URL = 'https://demo.vuestorefront.io'
const STOREFRONT_GIT_URL = 'https://github.com/DivanteLtd/vue-storefront'
const STOREFRONT_BACKEND_GIT_URL = 'https://github.com/DivanteLtd/vue-storefront-api'
const MAGENTO_SAMPLE_DATA_GIT_URL = 'https://github.com/magento/magento2-sample-data.git'

const STOREFRONT_DIRECTORY = shell.pwd()

const LOG_DIR = `${STOREFRONT_DIRECTORY}/var/log`
const INSTALL_LOG_FILE = `${STOREFRONT_DIRECTORY}/var/log/install.log`
const VUE_STOREFRONT_LOG_FILE = `${STOREFRONT_DIRECTORY}/var/log/vue-storefront.log`
const VUE_STOREFRONT_BACKEND_LOG_FILE = `${STOREFRONT_DIRECTORY}/var/log/vue-storefront-api.log`

/**
 * Message management
 */
class Message {
  /**
   * Renders informative message
   *
   * @param text
   */
  static info (text) {
    text = Array.isArray(text) ? text : [text]

    message([
      ...text
    ], {color: 'blue', border: false, marginTop: 1})
  }

  /**
   * Renders error message
   *
   * @param text
   * @param logFile
   */
  static error (text, logFile = INSTALL_LOG_FILE) {
    text = Array.isArray(text) ? text : [text]

    // show trace if exception occurred
    if (text[0] instanceof Error) {
      text = text[0].stack.split('\n')
    }

    let logDetailsInfo = `Please check log file for details: ${logFile}`

    if (!Abstract.logsWereCreated) {
      logDetailsInfo = 'Try to fix problem with logs to see the error details.'
    }

    message([
      'ERROR',
      '',
      ...text,
      '',
      logDetailsInfo
    ], {borderColor: 'red', marginBottom: 1})

    shell.exit(1)
  }

  /**
   * Render warning message
   *
   * @param text
   */
  static warning (text) {
    text = Array.isArray(text) ? text : [text]

    message([
      'WARNING:',
      ...text
    ], {color: 'yellow', border: false, marginTop: 1})
  }

  /**
   * Render block info message
   *
   * @param text
   */
  static greeting (text) {
    text = Array.isArray(text) ? text : [text]

    message([
      ...text
    ], {borderColor: 'green', marginBottom: 1})
  }
}

/**
 * Abstract class for field initialization
 */
class Abstract {
  /**
   * Constructor
   *
   * Initialize fields
   */
  constructor (answers) {
    this.answers = answers
  }
}

/**
 * Scripts for initialization backend
 */
class Backend extends Abstract {
  /**
   * Clone API repository
   *
   * @returns {Promise}
   */
  cloneRepository () {
    return new Promise((resolve, reject) => {
      Message.info(`Cloning backend into '${this.answers.backend_dir}'...`)

      if (shell.exec(`${this.answers.git_path} clone ${STOREFRONT_BACKEND_GIT_URL} ${this.answers.backend_dir} > ${Abstract.infoLogStream} 2>&1`).code !== 0) {
        reject(`Can't clone backend into '${this.answers.backend_dir}'.`)
      }

      resolve()
    })
  }

  /**
   * Go to backend directory
   *
   * @returns {Promise}
   */
  goToDirectory () {
    return new Promise((resolve, reject) => {
      Message.info(`Trying change directory to '${this.answers.backend_dir}'...`)

      if (shell.cd(this.answers.backend_dir).code !== 0) {
        reject(`Can't change directory to '${this.answers.backend_dir}'.`)
      }

      Message.info(`Working in directory '${shell.pwd()}'...`)

      resolve()
    })
  }

  /**
   * Run 'npm install' in backend directory
   *
   * @returns {Promise}
   */
  npmInstall () {
    return new Promise((resolve, reject) => {
      Message.info('Installing backend npm...')

      if (shell.exec(`npm i >> ${Abstract.infoLogStream} 2>&1`).code !== 0) {
        reject('Can\'t install backend npm.')
      }

      resolve()
    })
  }

  /**
   * Run 'docker-compose up' in background
   *
   * @returns {Promise}
   */
  dockerComposeUp () {
    return new Promise((resolve, reject) => {
      Message.info('Starting docker in background...')

      if (shell.exec(`docker-compose up -d > /dev/null 2>&1`).code !== 0) {
        reject('Can\'t start docker in background.')
      }

      resolve()
    })
  }

  /**
   * Creating backend src/config.json
   *
   * @returns {Promise}
   */
  createConfig () {
    return new Promise((resolve, reject) => {
      let config

      Message.info(`Creating backend config '${TARGET_CONFIG_FILE}'...`)

      try {
        config = jsonFile.readFileSync(SOURCE_CONFIG_FILE)
        let host = urlParser(this.answers.images_endpoint).host

        if (!host.length) {
          throw new Error()
        }

        config.imageable.whitelist.allowedHosts.push(host)
        config.imageable.whitelist.trustedHosts.push(host)

        jsonFile.writeFileSync(TARGET_CONFIG_FILE, config, {spaces: 2})
      } catch (e) {
        reject('Can\'t create backend config.')
      }

      resolve()
    })
  }

  /**
   * Run 'npm run restore'
   *
   * @returns {Promise}
   */
  restoreElasticSearch () {
    return new Promise((resolve, reject) => {
      Message.info('Restoring data for ElasticSearch...')

      if (shell.exec(`npm run restore >> ${Abstract.infoLogStream} 2>&1`).code !== 0) {
        reject('Can\'t restore data for ElasticSearch.')
      }

      resolve()
    })
  }

  /**
   * Run 'npm run migrate'
   *
   * @returns {Promise}
   */
  migrateElasticSearch () {
    return new Promise((resolve, reject) => {
      Message.info('Migrating data into ElasticSearch...')

      if (shell.exec(`npm run migrate >> ${Abstract.infoLogStream} 2>&1`).code !== 0) {
        reject('Can\'t migrate data into ElasticSearch.')
      }

      resolve()
    })
  }

  /**
   * Cloning magento sample data
   *
   * @returns {Promise}
   */
  cloneMagentoSampleData () {
    return new Promise((resolve, reject) => {
      Message.info(`Cloning Magento 2 Sample Data into '${SAMPLE_DATA_PATH}'...`)

      if (shell.exec(`${this.answers.git_path} clone ${MAGENTO_SAMPLE_DATA_GIT_URL} ${SAMPLE_DATA_PATH} >> ${Abstract.infoLogStream} 2>&1`).code !== 0) {
        reject(`Can't clone Magento 2 Sample Data into '${SAMPLE_DATA_PATH}'...`)
      }

      resolve()
    })
  }

  /**
   * Start 'npm run dev' in background
   *
   * @returns {Promise}
   */
  runDevEnvironment () {
    return new Promise((resolve, reject) => {
      Message.info('Starting backend server...')

      if (shell.exec(`nohup npm run dev > ${Abstract.backendLogStream} 2>&1 &`).code !== 0) {
        reject('Can\'t start dev server.', VUE_STOREFRONT_BACKEND_LOG_FILE)
      }

      resolve()
    })
  }
}

/**
 * Scripts for initialization storefront
 */
class Storefront extends Abstract {
  /**
   * Go to storefront directory
   *
   * @returns {Promise}
   */
  goToDirectory () {
    return new Promise((resolve, reject) => {
      if (Abstract.wasLocalBackendInstalled) {
        Message.info(`Trying change directory to '${STOREFRONT_DIRECTORY}'...`)

        if (shell.cd(STOREFRONT_DIRECTORY).code !== 0) {
          reject(`Can't change directory to '${STOREFRONT_DIRECTORY}'.`)
        }

        Message.info(`Working in directory '${STOREFRONT_DIRECTORY}'...`)
      }

      resolve()
    })
  }

  /**
   * Creating storefront src/config.json
   *
   * @returns {Promise}
   */
  createConfig () {
    return new Promise((resolve, reject) => {
      let config

      Message.info(`Creating storefront config '${TARGET_CONFIG_FILE}'...`)

      try {
        config = jsonFile.readFileSync(SOURCE_CONFIG_FILE)

        let backendPath

        if (Abstract.wasLocalBackendInstalled) {
          backendPath = 'localhost:8080'
        } else {
          backendPath = STOREFRONT_REMOTE_BACKEND_URL
        }

        config.elasticsearch.host = `${backendPath}/api/catalog`
        config.orders.endpoint = `${backendPath}/api/order/create`
        config.images.baseUrl = this.answers.images_endpoint

        jsonFile.writeFileSync(TARGET_CONFIG_FILE, config, {spaces: 2})
      } catch (e) {
        reject('Can\'t create storefront config.')
      }

      resolve()
    })
  }

  /**
   * Run 'npm run build' on storefront
   *
   * @returns {Promise}
   */
  npmBuild () {
    return new Promise((resolve, reject) => {
      Message.info('Build storefront npm...')

      if (shell.exec(`npm run build > ${Abstract.storefrontLogStream} 2>&1`).code !== 0) {
        reject('Can\'t build storefront npm.', VUE_STOREFRONT_LOG_FILE)
      }

      resolve()
    })
  }

  /**
   * Start 'npm run dev' in background
   *
   * @returns {Promise}
   */
  runDevEnvironment (answers) {
    return new Promise((resolve, reject) => {
      Message.info('Starting storefront server...')

      if (shell.exec(`nohup npm run dev >> ${Abstract.storefrontLogStream} 2>&1 &`).code !== 0) {
        reject('Can\'t start storefront server.', VUE_STOREFRONT_LOG_FILE)
      }

      resolve(answers)
    })
  }
}

class Manager extends Abstract {
  /**
   * {@inheritDoc}
   *
   * Assign backend and storefront entities
   */
  constructor (answers) {
    super(answers)

    this.backend = new Backend(answers)
    this.storefront = new Storefront(answers)
  }

  /**
   * Trying to create log files
   * If is impossible - warning shows
   *
   * @returns {Promise}
   */
  tryToCreateLogFiles () {
    return new Promise((resolve, reject) => {
      Message.info('Trying to create log files...')

      try {
        mkdirp.sync(LOG_DIR, {mode: parseInt('0755', 8)})

        let logFiles = [
          INSTALL_LOG_FILE,
          VUE_STOREFRONT_BACKEND_LOG_FILE,
          VUE_STOREFRONT_LOG_FILE
        ]

        for (let logFile of logFiles) {
          if (shell.touch(logFile).code !== 0 || !exists(logFile)) {
            throw new Error()
          }
        }

        Abstract.logsWereCreated = true
        Abstract.infoLogStream = INSTALL_LOG_FILE
        Abstract.storefrontLogStream = VUE_STOREFRONT_LOG_FILE
        Abstract.backendLogStream = VUE_STOREFRONT_BACKEND_LOG_FILE
      } catch (e) {
        Message.warning('Can\'t create log files.')
      }

      resolve()
    })
  }

  /**
   * Initialize all processes for backend (if selected)
   *
   * @returns {Promise}
   */
  initBackend () {
    if (this.answers.is_remote_backend === false) {
      Abstract.wasLocalBackendInstalled = true

      return this.backend.cloneRepository()
        .then(this.backend.goToDirectory.bind(this.backend))
        .then(this.backend.npmInstall.bind(this.backend))
        .then(this.backend.dockerComposeUp.bind(this.backend))
        .then(this.backend.createConfig.bind(this.backend))
        .then(this.backend.restoreElasticSearch.bind(this.backend))
        .then(this.backend.migrateElasticSearch.bind(this.backend))
        .then(this.backend.cloneMagentoSampleData.bind(this.backend))
        .then(this.backend.runDevEnvironment.bind(this.backend))
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Initialize all processes for storefront
   *
   * @returns {Promise}
   */
  initStorefront () {
    return this.storefront.goToDirectory()
      .then(this.storefront.createConfig.bind(this.storefront))
      .then(this.storefront.npmBuild.bind(this.storefront))
      .then(this.storefront.runDevEnvironment.bind(this.storefront))
  }

  /**
   * Check user OS and shows error if not supported
   */
  static checkUserOS () {
    if (isWindows()) {
      Message.error([
        'Unfortunately currently only Linux and OSX are supported.',
        'To install vue-storefront on your mac please go threw manual installation process provided in documentation:',
        `${STOREFRONT_GIT_URL}/blob/master/doc/Installing%20on%20Windows.md`
      ])
    }
  }

  /**
   * Shows message rendered on the very beginning
   */
  static showWelcomeMessage () {
    Message.greeting([
      'Hi, welcome to the vue-storefront installation.',
      'Let\'s configure it together :)'
    ])
  }

  /**
   * Shows details about successful installation finish
   *
   * @returns {Promise}
   */
  showGoodbyeMessage () {
    return new Promise((resolve, reject) => {
      Message.greeting([
        'Congratulations!',
        '',
        'You\'ve just successfully installed vue-storefront.',
        'All required servers are running in background',
        '',
        'Storefront: http://localhost:3000',
        'Backend: ' + (Abstract.wasLocalBackendInstalled ? 'http://localhost:8080' : STOREFRONT_REMOTE_BACKEND_URL),
        '',
        Abstract.logsWereCreated ? `Logs: ${LOG_DIR}/.` : '',
        '',
        'Good Luck!'
      ])

      resolve()
    })
  }
}

/**
 * Here we configure questions
 *
 * @type {[Object,Object,Object,Object]}
 */
let questions = [
  {
    type: 'confirm',
    name: 'is_remote_backend',
    message: `Would you like to use ${STOREFRONT_REMOTE_BACKEND_URL} as the backend?`,
    default: true
  },
  {
    type: 'input',
    name: 'git_path',
    message: 'Please provide Git path',
    default: '/usr/bin/git',
    when: function (answers) {
      return answers.is_remote_backend === false
    },
    validate: function (value) {
      if (!commandExists.sync(value)) {
        return 'Invalid git path. Try again ;)'
      }

      return true
    }
  },
  {
    type: 'input',
    name: 'backend_dir',
    message: 'Please provide path for installing backend locally',
    default: '../vue-storefront-api',
    when: function (answers) {
      return answers.is_remote_backend === false
    },
    validate: function (value) {
      try {
        mkdirp.sync(value, {mode: parseInt('0755', 8)})

        if (!isEmptyDir.sync(value)) {
          return 'Please provide path to empty directory.'
        }
      } catch (error) {
        return 'Can\'t access to write in this directory. Try again ;)'
      }

      return true
    }
  },
  {
    type: 'input',
    name: 'images_endpoint',
    message: 'Please provide path for images endpoint',
    default: `${STOREFRONT_REMOTE_BACKEND_URL}/img`,
    filter: function (url) {
      return url.slice(-1) === '/' ? url : `${url}/`
    }
  }
]

/**
 * Pre-loading staff
 */
Manager.checkUserOS()
Manager.showWelcomeMessage()

/**
 * Predefine class static variables
 */
Abstract.wasLocalBackendInstalled = false
Abstract.logsWereCreated = false
Abstract.infoLogStream = '/dev/null'
Abstract.storefrontLogStream = '/dev/null'
Abstract.backendLogStream = '/dev/null'

/**
 * This is where all the magic happens
 */
inquirer.prompt(questions).then(async function (answers) {
  let manager = new Manager(answers)

  await manager.tryToCreateLogFiles()
    .then(manager.initBackend.bind(manager))
    .then(manager.initStorefront.bind(manager))
    .then(manager.showGoodbyeMessage.bind(manager))
    .catch(Message.error)

  shell.exit(0)
})
