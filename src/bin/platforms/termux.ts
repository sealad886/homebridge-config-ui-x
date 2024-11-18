import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

import { chmod, existsSync, outputFile, unlinkSync } from 'fs-extra'

import { BasePlatform } from '../base-platform'

export class TermuxInstaller extends BasePlatform {
    private get serviceName() {
        return this.hbService.serviceName.toLowerCase()
    }

    private get servicePath() {
        return resolve('/data/data/com.termux/files/usr/etc/sv', this.serviceName)
    }

    /**
     * Installs the termux-service
     */
    public async install() {
        await this.checkUser()
        this.setupTermuxService()

        try {
            await this.createServiceScript()
            await this.enableService()
            await this.start()
            await this.hbService.printPostInstallInstructions()
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed Operation', 'fail')
        }
    }

    /**
     * Removes the termux-service
     */
    public async uninstall() {
        try {
            if (existsSync(this.servicePath)) {
                unlinkSync(`${this.servicePath}/run`)
                unlinkSync(`${this.servicePath}/log/run`)
                unlinkSync(this.servicePath)
                execSync(`rmdir ${this.servicePath}/log`) // Remove empty log directory
                execSync(`rmdir ${this.servicePath}`)     // Remove the main service directory
                this.hbService.logger(`Removed ${this.serviceName} Service`, 'succeed')
            } else {
                this.hbService.logger(`Could not find installed ${this.serviceName} Service.`, 'fail')
            }
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed Operation', 'fail')
        }
    }

    /**
     * Starts the termux-service
     */
    public async start() {
        try {
            this.hbService.logger(`Starting ${this.serviceName} Service...`)
            execSync(`sv up ${this.serviceName}`, { stdio: 'inherit' })
            this.hbService.logger(`${this.serviceName} Started`, 'succeed')
        } catch (e) {
            this.hbService.logger(`Failed to start ${this.serviceName}`, 'fail')
        }
    }

    /**
     * Stops the termux-service
     */
    public async stop() {
        try {
            this.hbService.logger(`Stopping ${this.serviceName} Service...`)
            execSync(`sv down ${this.serviceName}`, { stdio: 'inherit' })
            this.hbService.logger(`${this.serviceName} Stopped`, 'succeed')
        } catch (e) {
            this.hbService.logger(`Failed to stop ${this.serviceName}`, 'fail')
        }
    }

    /**
     * Restarts the termux-service
     */
    public async restart() {
        try {
            this.hbService.logger(`Restarting ${this.serviceName} Service...`)
            execSync(`sv restart ${this.serviceName}`, { stdio: 'inherit' })
            this.hbService.logger(`${this.serviceName} Restarted`, 'succeed')
        } catch (e) {
            this.hbService.logger(`Failed to restart ${this.serviceName}`, 'fail')
        }
    }

    /**
     * Rebuilds the Node.js modules for Homebridge UI
     */
    public async rebuild(all = false) {
        try {
            const npmGlobalPath = execSync('/bin/echo -n "$(npm -g prefix)/lib/node_modules"', {
                env: Object.assign({
                    npm_config_loglevel: 'silent',
                    npm_update_notifier: 'false',
                }, process.env),
            }).toString('utf8')
            const targetNodeVersion = execSync('node -v').toString('utf8').trim()

            execSync('npm rebuild --unsafe-perm', {
                cwd: process.env.UIX_BASE_PATH,
                stdio: 'inherit',
            })

            if (all === true) {
                // rebuild all modules
                try {
                    execSync('npm rebuild --unsafe-perm', {
                        cwd: npmGlobalPath,
                        stdio: 'inherit',
                    })
                } catch (e) {
                    this.hbService.logger('Could not rebuild all modules - check Homebridge logs.', 'warn')
                }
            }

            this.hbService.logger(`Rebuilt modules in ${process.env.UIX_BASE_PATH} for Node.js ${targetNodeVersion}.`, 'succeed')
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed Operation', 'fail')
        }
    }

    /**
     * Runs Homebridge UI directly
     */
    public async run() {
        try {
            this.hbService.logger(`Running ${this.serviceName}...`)
            execSync(`${this.hbService.selfPath} run -U ${this.hbService.storagePath}`, { stdio: 'inherit' })
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed to run Homebridge', 'fail')
        }
    }

    /**
     * Displays the logs for the termux-service
     */
    public async logs() {
        try {
            this.hbService.logger(`Displaying logs for ${this.serviceName}...`)
            execSync(`sv status ${this.serviceName}`, { stdio: 'inherit' })
            execSync(`tail -f /data/data/com.termux/files/home/.homebridge/log/current`, { stdio: 'inherit' })
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed to display logs', 'fail')
        }
    }

    /**
     * Views the current configuration
     */
    public async view() {
        try {
            const configPath = `${this.hbService.storagePath}/config.json`
            if (existsSync(configPath)) {
                execSync(`cat ${configPath}`, { stdio: 'inherit' })
            } else {
                this.hbService.logger(`Config file not found at ${configPath}.`, 'fail')
            }
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed to view configuration', 'fail')
        }
    }

    /**
     * Adds a new accessory or plugin
     */
    public async add(type: string, name: string) {
        try {
            if (type === 'accessory') {
                // Add accessory logic here
                this.hbService.logger(`Adding accessory ${name}...`)
                execSync(`${this.hbService.selfPath} add-accessory -N ${name}`, { stdio: 'inherit' })
                this.hbService.logger(`Accessory ${name} added successfully.`, 'succeed')
            } else if (type === 'plugin') {
                // Add plugin logic here
                this.hbService.logger(`Adding plugin ${name}...`)
                execSync(`${this.hbService.selfPath} add-plugin ${name}`, { stdio: 'inherit' })
                this.hbService.logger(`Plugin ${name} added successfully.`, 'succeed')
            } else {
                this.hbService.logger('Invalid type. Use "accessory" or "plugin".', 'fail')
            }
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed to add accessory/plugin', 'fail')
        }
    }

    /**
     * Removes an accessory or plugin
     */
    public async remove(type: string, name: string) {
        try {
            if (type === 'accessory') {
                // Remove accessory logic here
                this.hbService.logger(`Removing accessory ${name}...`)
                execSync(`${this.hbService.selfPath} remove-accessory -N ${name}`, { stdio: 'inherit' })
                this.hbService.logger(`Accessory ${name} removed successfully.`, 'succeed')
            } else if (type === 'plugin') {
                // Remove plugin logic here
                this.hbService.logger(`Removing plugin ${name}...`)
                execSync(`${this.hbService.selfPath} remove-plugin ${name}`, { stdio: 'inherit' })
                this.hbService.logger(`Plugin ${name} removed successfully.`, 'succeed')
            } else {
                this.hbService.logger('Invalid type. Use "accessory" or "plugin".', 'fail')
            }
        } catch (e) {
            console.error(e.toString())
            this.hbService.logger('ERROR: Failed to remove accessory/plugin', 'fail')
        }
    }

    /**
     * Returns the users uid and gid.
     */
    public async getId(): Promise<{ uid: number, gid: number }> {
        const uid = execSync(`id -u ${this.hbService.asUser}`).toString('utf8').trim()
        const gid = execSync(`id -g ${this.hbService.asUser}`).toString('utf8').trim()

        return {
            uid: Number.parseInt(uid, 10),
            gid: Number.parseInt(gid, 10),
        }
    }

    /**
     * Enables termux-service for autostart
     */
    private async enableService() {
        try {
            execSync(`sv-enable ${this.serviceName}`, { stdio: 'inherit' })
        } catch (e) {
            this.hbService.logger(`WARNING: failed to run "sv-enable ${this.serviceName}"`, 'warn')
        }
    }

    /**
     * Setup termux service directories
     */
    private setupTermuxService() {
        if (!existsSync(this.servicePath)) {
            execSync(`mkdir -p ${this.servicePath}`)
            execSync(`mkdir -p ${this.servicePath}/log`)
        }
    }

    /**
     * Checks the user exists
     */
    private async checkUser() {
        try {
            // check if user exists
            execSync(`id ${this.hbService.asUser} 2> /dev/null`)
        } catch (e) {
            this.hbService.logger('ERROR: User does not exist. Termux runs as the current user.', 'fail')
            process.exit(1)
        }
    }

    /**
     * Create the termux-service script
     */
    private async createServiceScript() {
        const runFileContents = [
            '#!/data/data/com.termux/files/usr/bin/sh',
            `exec 2>&1`,
            `exec setsid ${this.hbService.selfPath} run -U ${this.hbService.storagePath}`,
        ].join('\n')

        const logRunFileContents = [
            '#!/data/data/com.termux/files/usr/bin/sh',
            'mkdir -p /data/data/com.termux/files/home/.homebridge/log',
            `exec chpst -u u0_a123:u0_a123 svlogd -tt /data/data/com.termux/files/home/.homebridge/log`
        ].join('\n')

        await outputFile(`${this.servicePath}/run`, runFileContents)
        await outputFile(`${this.servicePath}/log/run`, logRunFileContents)

        await chmod(`${this.servicePath}/run`, '755')
        await chmod(`${this.servicePath}/log/run`, '755')
    }
}
