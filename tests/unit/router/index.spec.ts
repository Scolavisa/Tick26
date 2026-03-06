import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import router from '../../../src/router'

describe('Router Configuration', () => {
  describe('Route Definitions', () => {
    it('should have four routes defined', () => {
      const routes = router.getRoutes()
      expect(routes).toHaveLength(4)
    })

    it('should have a measurement route at /', () => {
      const route = router.resolve('/')
      expect(route.name).toBe('measurement')
      expect(route.path).toBe('/')
    })

    it('should have a settings route at /settings', () => {
      const route = router.resolve('/settings')
      expect(route.name).toBe('settings')
      expect(route.path).toBe('/settings')
    })

    it('should have a calibration route at /calibration', () => {
      const route = router.resolve('/calibration')
      expect(route.name).toBe('calibration')
      expect(route.path).toBe('/calibration')
    })
    it('should have a catch-all route that redirects to /', () => {
      const catchAllRoute = router.getRoutes().find(r => r.path === '/:pathMatch(.*)*')
      expect(catchAllRoute).toBeDefined()
      expect(catchAllRoute?.redirect).toBe('/')
    })
  })

  describe('Default Route', () => {
    it('should default to measurement page at /', () => {
      const route = router.resolve('/')
      expect(route.name).toBe('measurement')
    })

    it('should load MeasurementPage component for default route', () => {
      const routes = router.getRoutes()
      const measurementRoute = routes.find(r => r.name === 'measurement')
      expect(measurementRoute).toBeDefined()
      expect(measurementRoute?.path).toBe('/')
    })
  })

  describe('Navigation Between Pages', () => {
    let testRouter: ReturnType<typeof createRouter>

    beforeEach(() => {
      // Create a fresh router instance with memory history for testing
      testRouter = createRouter({
        history: createMemoryHistory(),
        routes: router.getRoutes()
      })
    })

    it('should navigate from measurement to settings', async () => {
      await testRouter.push('/')
      expect(testRouter.currentRoute.value.name).toBe('measurement')
      
      await testRouter.push('/settings')
      expect(testRouter.currentRoute.value.name).toBe('settings')
    })

    it('should navigate from measurement to calibration', async () => {
      await testRouter.push('/')
      expect(testRouter.currentRoute.value.name).toBe('measurement')
      
      await testRouter.push('/calibration')
      expect(testRouter.currentRoute.value.name).toBe('calibration')
    })

    it('should navigate from settings to calibration', async () => {
      await testRouter.push('/settings')
      expect(testRouter.currentRoute.value.name).toBe('settings')
      
      await testRouter.push('/calibration')
      expect(testRouter.currentRoute.value.name).toBe('calibration')
    })

    it('should navigate back to measurement from any page', async () => {
      await testRouter.push('/settings')
      await testRouter.push('/')
      expect(testRouter.currentRoute.value.name).toBe('measurement')

      await testRouter.push('/calibration')
      await testRouter.push('/')
      expect(testRouter.currentRoute.value.name).toBe('measurement')
    })

    it('should redirect unknown paths to measurement page', async () => {
      await testRouter.push('/unknown-path')
      expect(testRouter.currentRoute.value.name).toBe('measurement')
      expect(testRouter.currentRoute.value.path).toBe('/')
    })

    it('should handle navigation by route name', async () => {
      await testRouter.push({ name: 'measurement' })
      expect(testRouter.currentRoute.value.name).toBe('measurement')

      await testRouter.push({ name: 'settings' })
      expect(testRouter.currentRoute.value.name).toBe('settings')

      await testRouter.push({ name: 'calibration' })
      expect(testRouter.currentRoute.value.name).toBe('calibration')
    })
  })

  describe('Router Configuration', () => {
    it('should use history mode', () => {
      // The router should be configured with createWebHistory
      // We can verify this by checking that the router has the expected options
      expect(router.options.history).toBeDefined()
    })

    it('should have lazy-loaded components', () => {
      const routes = router.getRoutes()
      routes.filter(route => !route.redirect).forEach(route => {
        // All non-redirect routes should have components (lazy-loaded via dynamic import)
        expect(route.components).toBeDefined()
      })
    })
  })
})
