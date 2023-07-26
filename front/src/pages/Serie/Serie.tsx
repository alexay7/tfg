import React, {useEffect, useState} from "react";
import {useQuery} from "react-query";
import {useNavigate, useParams} from "react-router-dom";
import {api} from "../../api/api";
import {FullSerie, SerieWithProgress} from "../../types/serie";
import {Button, Divider, IconButton} from "@mui/material";
import {BookComponent} from "../../components/BookComponent/BookComponent";
import {BookWithProgress} from "../../types/book";
import {useGlobal} from "../../contexts/GlobalContext";
import {ArrowBack, ArrowDropDown, ArrowDropUp, Edit} from "@mui/icons-material";
import {SerieSettings} from "../../components/SerieComponent/components/SerieSettings";
import {goBack, goTo} from "../../helpers/helpers";

export function Serie():React.ReactElement {
    const {id} = useParams();
    const {reloaded} = useGlobal();
    const [readMore, setReadMore] = useState(false);

    const {data:serieData, refetch:serieRefetch} = useQuery(`serie-${id}`, async()=>{
        const response = await api.get<FullSerie>(`series/${id}`);
        return response;
    }, {refetchOnWindowFocus:false});

    const {data:serieBooks, refetch:booksRefetch} = useQuery(`books-serie-${id}`, async()=>{
        const response = await api.get<BookWithProgress[]>(`books?serie=${id}&sort=sortName`);
        return response;
    }, {refetchOnWindowFocus:false});

    const navigate = useNavigate();

    useEffect(()=>{
        async function refetchBooks():Promise<void> {
            await booksRefetch();
            await serieRefetch();
        }

        if (reloaded) {
            void refetchBooks();
        }
    }, [booksRefetch, serieRefetch, reloaded]);

    function getReadButtonText(auxData:SerieWithProgress):string {
        if (auxData.unreadBooks === 0) return "Leer de nuevo";

        if (auxData.unreadBooks === auxData.bookCount) return "Empezar a leer";

        return "Seguir leyendo";
    }

    return (
        <div className="bg-[#121212] overflow-x-hidden pb-4">
            <div className="fixed z-20 w-full bg-[#212121] py-1 flex items-center justify-between h-12">
                <div className="flex items-center mx-4">
                    <IconButton onClick={()=>goBack(navigate)}>
                        <ArrowBack/>
                    </IconButton>
                    {serieData && (
                        <div className="flex gap-4 items-center">
                            <SerieSettings serieData={serieData}/>
                            <p className="text-white text-2xl">{serieData.visibleName}</p>
                            <p className="text-white px-3 py-1 bg-gray-500 rounded-md">{serieData.bookCount}</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center mx-4">
                    <IconButton>
                        <Edit/>
                    </IconButton>
                </div>
            </div>
            {serieData && (
                <div className="p-8 my-12">
                    <div className="flex w-full gap-8">
                        <div className="relative w-[14rem] pointer-events-none flex-shrink-0">
                            {serieData.unreadBooks > 0 && (
                                <div className="absolute top-0 right-0 text-white min-w-[1.5rem] h-6 text-center font-semibold">
                                    <p className="bg-primary p-2">{serieData.unreadBooks}</p>
                                </div>
                            )}
                            <img className="rounded-sm" src={`/api/static/${serieData.thumbnailPath}`} alt="" />
                        </div>
                        <div className="flex w-4/6 flex-col text-white">
                            <p className="text-3xl">{serieData.visibleName}</p>
                            <p className="text py-4 text-sm">{serieData.bookCount} libros</p>
                            {serieBooks && serieBooks.length > 0 && (
                                <Button color="inherit" variant="contained" className="w-fit my-4 py-1 px-2" onClick={()=>{
                                    goTo(navigate, `/reader/${serieBooks[0]._id}`);
                                }}
                                >{getReadButtonText(serieData)}
                                </Button>
                            )}
                            <div className="text-sm">
                                <p className="overflow-hidden whitespace-pre-line" style={{maxHeight:readMore ? "100%" : "10rem", transition:"max-height 0.3s ease"}}>{serieData.summary}</p>
                                <Button className="text-gray-600" onClick={()=>setReadMore(!readMore)}>Leer {readMore ? "menos" : "más"} {readMore ? <ArrowDropUp/> : <ArrowDropDown/>}</Button>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-8 pb-4">
                        <div className="flex text-white items-center">
                            <p className="w-[14rem] text-sm">GÉNEROS</p>
                            <ul className="list-none flex gap-2 text-xs">
                                {serieData.genres.map((genre)=>(
                                    <Button onClick={()=>goTo(navigate, `/app/library?genre=${genre}`)} className="px-2 py-0 text-white normal-case border border-solid border-gray-700 rounded-md" key={genre}>{genre}</Button>
                                ))}
                            </ul>
                        </div>
                        <div className="flex text-white items-center">
                            <p className="w-[14rem] text-sm">AUTORES</p>
                            <ul className="list-none flex gap-2 text-xs">
                                {serieData.authors.map((author)=>(
                                    <Button onClick={()=>goTo(navigate, `/app/library?author=${author}`)} className="px-2 py-0 text-white normal-case border border-solid border-gray-700 rounded-md" key={author}>{author}</Button>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <Divider/>
                    <ul className="flex flex-wrap gap-4 py-4">
                        {serieBooks && serieBooks.length > 0 && serieBooks.map((book)=>(
                            <BookComponent key={book._id} bookData={book} insideSerie/>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}