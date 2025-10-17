import axios from "axios";
import 'dotenv/config';

const STRAPI_URL = 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_TOKEN;


export async function getProductsStrapi() {
  console.log('Obteniendo productos desde Strapi...');
  
  try {
    let productos = [];
    let pagina = 1;
    let totalPaginas = 1;

    // Obtener todos los productos con paginación
    while (pagina <= totalPaginas) {
      const response = await axios.get(`${STRAPI_URL}/api/productos`, {
        headers: STRAPI_API_TOKEN ? {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`
        } : {},
        params: {
          pagination: {
            page: pagina,
            pageSize: 10,
          },
          populate: '*', // Incluir imagenes y relaciones
        }
      });

      const data = response.data;
      productos.push(...data.data);
      
      totalPaginas = data.meta.pagination.pageCount;
      
      console.log(`Página ${pagina}/${totalPaginas} - ${data.data.length} productos`);
      
      pagina++;
    }

    console.log(`Total productos obtenidos: ${productos.length}\n`);
    
    return productos;

  } catch (error) {
    console.error('Error al obtener productos de Strapi:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Detalles:', error.response.data);
    }
    
    throw new Error('No se pudieron cargar los productos desde Strapi');
  }
}

export function convertProducts(productosStrapi) {
  console.log('Transformando formato de productos...');
  
  return productosStrapi.map(producto => {
    // Adaptamos el formato de Strapi al formato que espera tu sistema HNSW
    return {
      id: producto.id,
      documentId: producto.documentId, // Strapi v5
      name: producto.name,
      description: producto.description || '',
      additional_information: producto.additional_information || '',
      category: producto.category || '',
      tag: producto.tag || '',
      price: producto.price || null,
      stock: producto.stock || 0,
      slug: producto.slug,
      
      // Imágenes (si las necesitas)
      images: producto.images?.map(img => ({
        id: img.id,
        url: `${STRAPI_URL}${img.url}`,
        name: img.name,
      })) || [],
      
      
    };
  });
}