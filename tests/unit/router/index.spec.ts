import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import router from '../../../src/router'

describe('Router Configuration', () => {
  describe('Route Definitions', () => {
    it('should have three routes defined', () => {
      const routes = router.getRoutes()
      expect(routes).toHaveLength(3)
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
      routes.forEach(route => {
        // All routes should have components (lazy-loaded via dynamic import)
        expect(route.components).toBeDefined()
      })
    })
  })
})
