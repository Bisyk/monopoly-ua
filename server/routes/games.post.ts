import { games } from './gamesList'

export default defineEventHandler(async event => {
  const body: CreatedGame = await readBody(event)
  games.value.push(body)
  return { body: JSON.stringify({ games: games.value }) }
})
